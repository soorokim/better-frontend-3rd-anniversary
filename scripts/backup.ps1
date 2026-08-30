#Requires -Version 7.2
<#
.SYNOPSIS
Creates and validates an atomic PostgreSQL custom-format backup.

.PARAMETER RetentionDays
Deletes older *.dump files only when explicitly set to a positive number.
The default, 0, never removes an existing backup.

.OUTPUTS
The absolute path of the completed backup archive.
#>
[CmdletBinding()]
param(
    [string]$ComposeDirectory = (Join-Path $PSScriptRoot '..'),
    [string]$DestinationDirectory = (Join-Path $PSScriptRoot '..' 'backups'),
    [ValidateRange(0, 3650)]
    [int]$RetentionDays = 0,
    [string]$DatabaseName,
    [string]$DatabaseUser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-ExternalText {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(Mandatory)][string[]]$Arguments
    )

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FilePath
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    foreach ($argument in $Arguments) {
        [void]$startInfo.ArgumentList.Add($argument)
    }

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
        throw "Failed to start '$FilePath'."
    }

    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()

    if ($process.ExitCode -ne 0) {
        throw "Command failed ($FilePath, exit $($process.ExitCode)): $($stderr.Trim())"
    }

    return $stdout.Trim()
}

function Protect-BackupFile {
    param([Parameter(Mandatory)][string]$Path)

    if ($IsWindows) {
        $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        $acl = [System.Security.AccessControl.FileSecurity]::new()
        $acl.SetAccessRuleProtection($true, $false)
        foreach ($principal in @($identity, 'NT AUTHORITY\SYSTEM', 'BUILTIN\Administrators')) {
            $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
                $principal,
                [System.Security.AccessControl.FileSystemRights]::FullControl,
                [System.Security.AccessControl.AccessControlType]::Allow
            )
            [void]$acl.AddAccessRule($rule)
        }
        Set-Acl -LiteralPath $Path -AclObject $acl
        return
    }

    [void](Invoke-ExternalText -FilePath 'chmod' -Arguments @('600', $Path))
}

$composeRoot = (Resolve-Path -LiteralPath $ComposeDirectory).Path
$composeFile = Join-Path $composeRoot 'compose.yaml'
if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
    throw "compose.yaml was not found in '$composeRoot'."
}

$destinationRoot = [System.IO.Path]::GetFullPath($DestinationDirectory)
[void][System.IO.Directory]::CreateDirectory($destinationRoot)

$composeArgs = @('compose', '--project-directory', $composeRoot)
$containerId = Invoke-ExternalText -FilePath 'docker' -Arguments ($composeArgs + @('ps', '-q', 'db'))
if ([string]::IsNullOrWhiteSpace($containerId)) {
    throw 'The Compose db service is not running.'
}

if ([string]::IsNullOrWhiteSpace($DatabaseName)) {
    $DatabaseName = Invoke-ExternalText -FilePath 'docker' -Arguments @('exec', $containerId, 'printenv', 'POSTGRES_DB')
}
if ([string]::IsNullOrWhiteSpace($DatabaseUser)) {
    $DatabaseUser = Invoke-ExternalText -FilePath 'docker' -Arguments @('exec', $containerId, 'printenv', 'POSTGRES_USER')
}
if ([string]::IsNullOrWhiteSpace($DatabaseName) -or [string]::IsNullOrWhiteSpace($DatabaseUser)) {
    throw 'Database name and user must be provided or available in the db container environment.'
}

$timestamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$safeDatabaseName = $DatabaseName -replace '[^A-Za-z0-9_.-]', '_'
$baseName = "$safeDatabaseName-$timestamp-$([guid]::NewGuid().ToString('N').Substring(0, 8)).dump"
$finalPath = Join-Path $destinationRoot $baseName
$temporaryPath = "$finalPath.partial"
$containerPath = "/tmp/frontend-anniv-$([guid]::NewGuid().ToString('N')).dump"

try {
    [void](Invoke-ExternalText -FilePath 'docker' -Arguments @(
        'exec', $containerId, 'pg_dump',
        '--format=custom', '--no-owner', '--no-privileges',
        "--file=$containerPath", "--username=$DatabaseUser", $DatabaseName
    ))
    [void](Invoke-ExternalText -FilePath 'docker' -Arguments @(
        'exec', $containerId, 'pg_restore', '--list', $containerPath
    ))
    $containerChecksumOutput = Invoke-ExternalText -FilePath 'docker' -Arguments @(
        'exec', $containerId, 'sha256sum', $containerPath
    )
    $containerChecksum = ($containerChecksumOutput -split '\s+', 2)[0].ToUpperInvariant()
    [void](Invoke-ExternalText -FilePath 'docker' -Arguments @(
        'cp', "${containerId}:$containerPath", $temporaryPath
    ))

    if (-not (Test-Path -LiteralPath $temporaryPath -PathType Leaf) -or
        (Get-Item -LiteralPath $temporaryPath).Length -eq 0) {
        throw 'The backup archive is empty or was not copied from the database container.'
    }
    $hostChecksum = (Get-FileHash -LiteralPath $temporaryPath -Algorithm SHA256).Hash
    if ($hostChecksum -cne $containerChecksum) {
        throw 'The copied backup checksum does not match the validated container archive.'
    }

    Protect-BackupFile -Path $temporaryPath
    [System.IO.File]::Move($temporaryPath, $finalPath, $false)
}
finally {
    try {
        [void](Invoke-ExternalText -FilePath 'docker' -Arguments @('exec', $containerId, 'rm', '-f', $containerPath))
    }
    catch {
        Write-Warning "Could not remove temporary container file '$containerPath': $($_.Exception.Message)"
    }
    if (Test-Path -LiteralPath $temporaryPath) {
        Remove-Item -LiteralPath $temporaryPath -Force
    }
}

if ($RetentionDays -gt 0) {
    $cutoff = [DateTime]::UtcNow.AddDays(-$RetentionDays)
    Get-ChildItem -LiteralPath $destinationRoot -File -Filter '*.dump' |
        Where-Object { $_.FullName -ne $finalPath -and $_.LastWriteTimeUtc -lt $cutoff } |
        ForEach-Object {
            try {
                Remove-Item -LiteralPath $_.FullName -Force
            }
            catch {
                Write-Warning "Could not remove expired backup '$($_.FullName)': $($_.Exception.Message)"
            }
        }
}

Write-Output $finalPath
