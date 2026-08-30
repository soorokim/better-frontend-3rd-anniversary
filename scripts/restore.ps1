#Requires -Version 7.2
<#
.SYNOPSIS
Recreates an explicitly named database from a validated custom-format backup.

.DESCRIPTION
The confirmation text must be exactly "RESTORE <TargetDatabase>". An existing
target is backed up before it is dropped and recreated. The active app is
stopped and restarted when its database is the restore target.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$BackupFile,
    [Parameter(Mandatory)][string]$TargetDatabase,
    [Parameter(Mandatory)][string]$Confirmation,
    [string]$ComposeDirectory = (Join-Path $PSScriptRoot '..'),
    [string]$PreRestoreBackupDirectory = (Join-Path $PSScriptRoot '..' 'backups' 'pre-restore'),
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
    if (-not $process.Start()) { throw "Failed to start '$FilePath'." }
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

if ($TargetDatabase -notmatch '^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$') {
    throw 'TargetDatabase may contain only ASCII letters, digits, underscore, dot, and hyphen (maximum 63 characters).'
}
if ($TargetDatabase -in @('postgres', 'template0', 'template1')) {
    throw "Restoring into the maintenance database '$TargetDatabase' is not allowed."
}
$requiredConfirmation = "RESTORE $TargetDatabase"
if ($Confirmation -cne $requiredConfirmation) {
    throw "Confirmation must exactly match '$requiredConfirmation'."
}

$sourcePath = (Resolve-Path -LiteralPath $BackupFile).Path
if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "Backup file '$BackupFile' is not a regular file."
}
$composeRoot = (Resolve-Path -LiteralPath $ComposeDirectory).Path
if (-not (Test-Path -LiteralPath (Join-Path $composeRoot 'compose.yaml') -PathType Leaf)) {
    throw "compose.yaml was not found in '$composeRoot'."
}

$composeArgs = @('compose', '--project-directory', $composeRoot)
$containerId = Invoke-ExternalText -FilePath 'docker' -Arguments ($composeArgs + @('ps', '-q', 'db'))
if ([string]::IsNullOrWhiteSpace($containerId)) { throw 'The Compose db service is not running.' }
if ([string]::IsNullOrWhiteSpace($DatabaseUser)) {
    $DatabaseUser = Invoke-ExternalText -FilePath 'docker' -Arguments @('exec', $containerId, 'printenv', 'POSTGRES_USER')
}
if ([string]::IsNullOrWhiteSpace($DatabaseUser)) { throw 'Database user is unavailable.' }

$activeDatabase = Invoke-ExternalText -FilePath 'docker' -Arguments @('exec', $containerId, 'printenv', 'POSTGRES_DB')
$containerArchive = "/tmp/frontend-anniv-restore-$([guid]::NewGuid().ToString('N')).dump"
$createdTarget = $false
$targetExisted = $false
$applicationWasRunning = $false
$restoreSucceeded = $false
$preRestoreBackup = $null
$restartFailure = $null

try {
    [void](Invoke-ExternalText -FilePath 'docker' -Arguments @('cp', $sourcePath, "${containerId}:$containerArchive"))
    [void](Invoke-ExternalText -FilePath 'docker' -Arguments @('exec', $containerId, 'pg_restore', '--list', $containerArchive))

    $escapedTarget = $TargetDatabase.Replace("'", "''")
    $exists = Invoke-ExternalText -FilePath 'docker' -Arguments @(
        'exec', $containerId, 'psql', '--tuples-only', '--no-align', '--username', $DatabaseUser,
        '--dbname', 'postgres', '--command', "SELECT 1 FROM pg_database WHERE datname = '$escapedTarget';"
    )
    $targetExisted = $exists -eq '1'

    if ($TargetDatabase -ceq $activeDatabase) {
        $appContainerId = Invoke-ExternalText -FilePath 'docker' -Arguments ($composeArgs + @('ps', '-q', 'app'))
        if (-not [string]::IsNullOrWhiteSpace($appContainerId)) {
            $applicationWasRunning = (Invoke-ExternalText -FilePath 'docker' -Arguments @(
                'inspect', '--format', '{{.State.Running}}', $appContainerId
            )) -eq 'true'
        }
        if ($applicationWasRunning) {
            [void](Invoke-ExternalText -FilePath 'docker' -Arguments ($composeArgs + @('stop', 'app')))
        }
    }

    if ($targetExisted) {
        # The active app has already been stopped when it owns this target. Take
        # the mandatory safety backup before any connection termination or drop.
        $backupScript = Join-Path $PSScriptRoot 'backup.ps1'
        $preRestoreBackup = & $backupScript -ComposeDirectory $composeRoot `
            -DestinationDirectory $PreRestoreBackupDirectory -RetentionDays 0 `
            -DatabaseName $TargetDatabase -DatabaseUser $DatabaseUser
        if ([string]::IsNullOrWhiteSpace($preRestoreBackup) -or
            -not (Test-Path -LiteralPath $preRestoreBackup -PathType Leaf)) {
            throw 'The mandatory pre-restore backup did not complete.'
        }
    }

    if ($targetExisted) {
        [void](Invoke-ExternalText -FilePath 'docker' -Arguments @(
            'exec', $containerId, 'psql', '--username', $DatabaseUser, '--dbname', 'postgres',
            '--command', "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$escapedTarget' AND pid <> pg_backend_pid();"
        ))
        # Recreate instead of restoring with --clean. Objects that are absent from
        # the archive must not survive an otherwise successful restore.
        [void](Invoke-ExternalText -FilePath 'docker' -Arguments @(
            'exec', $containerId, 'dropdb', '--username', $DatabaseUser, $TargetDatabase
        ))
    }

    [void](Invoke-ExternalText -FilePath 'docker' -Arguments @(
        'exec', $containerId, 'createdb', '--username', $DatabaseUser,
        '--owner', $DatabaseUser, '--template', 'template0', $TargetDatabase
    ))
    $createdTarget = $true

    [void](Invoke-ExternalText -FilePath 'docker' -Arguments @(
        'exec', $containerId, 'pg_restore', '--exit-on-error', '--single-transaction',
        '--no-owner', '--no-privileges',
        '--username', $DatabaseUser, '--dbname', $TargetDatabase, $containerArchive
    ))
    $restoreSucceeded = $true
}
catch {
    $restoreError = $_.Exception.Message
    if ($createdTarget -and -not $restoreSucceeded) {
        try {
            [void](Invoke-ExternalText -FilePath 'docker' -Arguments @(
                'exec', $containerId, 'dropdb', '--if-exists', '--username', $DatabaseUser, $TargetDatabase
            ))
        }
        catch {
            Write-Warning "Could not remove newly created failed restore target '$TargetDatabase': $($_.Exception.Message)"
        }
    }
    $recoveryHint = if ($null -ne $preRestoreBackup) {
        " The replaced database backup is '$preRestoreBackup'."
    }
    else {
        ''
    }
    throw "Restore of '$TargetDatabase' failed.$recoveryHint Cause: $restoreError"
}
finally {
    try {
        [void](Invoke-ExternalText -FilePath 'docker' -Arguments @('exec', $containerId, 'rm', '-f', $containerArchive))
    }
    catch {
        Write-Warning "Could not remove temporary container file '$containerArchive': $($_.Exception.Message)"
    }

    if ($applicationWasRunning) {
        try {
            [void](Invoke-ExternalText -FilePath 'docker' -Arguments ($composeArgs + @('up', '-d', '--no-deps', 'app')))
        }
        catch {
            $restartFailure = $_.Exception.Message
        }
    }
}

if ($null -ne $restartFailure) {
    throw "The restore completed, but the application could not be restarted: $restartFailure Pre-restore backup: '$preRestoreBackup'."
}

if ($applicationWasRunning) {
    $healthDeadline = [DateTime]::UtcNow.AddSeconds(120)
    do {
        $appContainerId = Invoke-ExternalText -FilePath 'docker' -Arguments ($composeArgs + @('ps', '-q', 'app'))
        $health = if ([string]::IsNullOrWhiteSpace($appContainerId)) {
            'missing'
        }
        else {
            Invoke-ExternalText -FilePath 'docker' -Arguments @(
                'inspect', '--format', '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}', $appContainerId
            )
        }
        if ($health -eq 'healthy') { break }
        if ($health -eq 'unhealthy') {
            throw "The restore completed, but the restarted application is unhealthy. Pre-restore backup: '$preRestoreBackup'."
        }
        Start-Sleep -Seconds 2
    } while ([DateTime]::UtcNow -lt $healthDeadline)

    if ($health -ne 'healthy') {
        throw "The restore completed, but the application health check timed out after 120 seconds. Pre-restore backup: '$preRestoreBackup'."
    }
}

Write-Output ([pscustomobject]@{
    targetDatabase = $TargetDatabase
    sourceBackup = $sourcePath
    preRestoreBackup = $preRestoreBackup
    restored = $restoreSucceeded
})
