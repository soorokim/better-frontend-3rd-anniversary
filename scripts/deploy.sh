#!/bin/sh
# Fast-forward deploy with a validated pre-migration backup and health rollback.
# Optional: DEPLOY_BACKUP_DIR, DEPLOY_HEALTH_TIMEOUT, DEPLOY_HEALTH_URL.
# DEPLOY_HEALTH_URL adds a host-side HTTP check; container health is always used.
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
BACKUP_DIR=${DEPLOY_BACKUP_DIR:-"$PROJECT_DIR/backups/pre-deploy"}
HEALTH_URL=${DEPLOY_HEALTH_URL:-}
HEALTH_TIMEOUT=${DEPLOY_HEALTH_TIMEOUT:-120}
LOCK_DIR="$PROJECT_DIR/.deploy.lock"

say() { printf '%s\n' "$*"; }
fail() { printf 'deploy: %s\n' "$*" >&2; exit 1; }
require_command() { command -v "$1" >/dev/null 2>&1 || fail "required command '$1' was not found"; }

require_command git
require_command docker
require_command chmod
require_command mv
require_command sha256sum
if [ -n "$HEALTH_URL" ]; then require_command curl; fi

case "$HEALTH_TIMEOUT" in
    ''|*[!0-9]*) fail 'DEPLOY_HEALTH_TIMEOUT must be a positive integer' ;;
    0) fail 'DEPLOY_HEALTH_TIMEOUT must be greater than zero' ;;
esac

cd "$PROJECT_DIR"
[ -f compose.yaml ] || fail "compose.yaml was not found in $PROJECT_DIR"
[ -f .env ] || fail '.env is required before deployment'
[ -z "$(git status --porcelain --untracked-files=normal)" ] || fail 'the Git working tree must be clean'

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    fail "another deployment may be running (lock: $LOCK_DIR)"
fi

container_temp=''
host_temp=''
rollback_ref=''
app_image_ref=''

cleanup() {
    status=$?
    trap - EXIT HUP INT TERM
    if [ -n "$container_temp" ] && [ -n "${db_container:-}" ]; then
        docker exec "$db_container" rm -f "$container_temp" >/dev/null 2>&1 || true
    fi
    if [ -n "$host_temp" ]; then rm -f -- "$host_temp"; fi
    if [ -n "$rollback_ref" ]; then docker image rm "$rollback_ref" >/dev/null 2>&1 || true; fi
    rmdir -- "$LOCK_DIR" 2>/dev/null || true
    exit "$status"
}
trap cleanup EXIT HUP INT TERM

old_revision=$(git rev-parse HEAD)
branch=$(git symbolic-ref --quiet --short HEAD) || fail 'deployment must run from a branch, not detached HEAD'
git rev-parse --abbrev-ref "${branch}@{upstream}" >/dev/null 2>&1 || fail "branch '$branch' has no upstream"

old_image_id=$(docker compose images -q app 2>/dev/null || true)
if [ -n "$old_image_id" ]; then
    app_image_ref=$(docker image inspect --format '{{index .RepoTags 0}}' "$old_image_id" 2>/dev/null || true)
    if [ -n "$app_image_ref" ] && [ "$app_image_ref" != '<no value>' ]; then
        rollback_ref="frontend-anniv-rollback:${old_revision}"
        docker tag "$old_image_id" "$rollback_ref"
    else
        app_image_ref=''
    fi
fi

say "Pulling $branch with fast-forward only..."
if ! git pull --ff-only; then
    fail 'git pull failed; the running containers were not changed'
fi
new_revision=$(git rev-parse HEAD)

say "Building application image for $new_revision..."
if ! docker compose build app; then
    fail 'image build failed; the previous application is still running'
fi

db_container=$(docker compose ps -q db)
[ -n "$db_container" ] || fail 'the Compose db service is not running'
database_name=$(docker exec "$db_container" printenv POSTGRES_DB)
database_user=$(docker exec "$db_container" printenv POSTGRES_USER)
[ -n "$database_name" ] && [ -n "$database_user" ] || fail 'database name/user is unavailable'

mkdir -p -- "$BACKUP_DIR"
timestamp=$(date -u '+%Y%m%dT%H%M%SZ')
safe_database_name=$(printf '%s' "$database_name" | tr -c 'A-Za-z0-9_.-' '_')
backup_path="$BACKUP_DIR/${safe_database_name}-${timestamp}-${new_revision}.dump"
host_temp="$backup_path.partial"
container_temp="/tmp/frontend-anniv-predeploy-${new_revision}-$$.dump"
[ ! -e "$backup_path" ] && [ ! -e "$host_temp" ] || fail "backup path already exists: $backup_path"

say "Creating and validating pre-deploy backup..."
docker exec "$db_container" pg_dump --format=custom --no-owner --no-privileges \
    --file="$container_temp" --username="$database_user" "$database_name"
docker exec "$db_container" pg_restore --list "$container_temp" >/dev/null
container_checksum=$(docker exec "$db_container" sha256sum "$container_temp")
container_checksum=${container_checksum%% *}
docker cp "${db_container}:${container_temp}" "$host_temp" >/dev/null
[ -s "$host_temp" ] || fail 'pre-deploy backup is empty'
host_checksum=$(sha256sum "$host_temp")
host_checksum=${host_checksum%% *}
[ "$host_checksum" = "$container_checksum" ] || fail 'pre-deploy backup checksum mismatch'
chmod 600 "$host_temp"
mv "$host_temp" "$backup_path"
host_temp=''
docker exec "$db_container" rm -f "$container_temp"
container_temp=''

say "Running database migrations..."
if ! docker compose run --rm migrate; then
    fail "migration failed; the old application remains running and backup is at $backup_path"
fi

rollback_app() {
    if [ -z "$rollback_ref" ] || [ -z "$app_image_ref" ]; then
        printf 'deploy: automatic application rollback is unavailable; backup: %s\n' "$backup_path" >&2
        return 1
    fi
    say "Health gate failed; restoring previous application image..."
    docker tag "$rollback_ref" "$app_image_ref"
    docker compose up -d --no-deps --force-recreate app
    printf 'deploy: application image rolled back; database migrations were not reversed. Backup: %s\n' "$backup_path" >&2
}

say 'Starting the candidate application...'
if ! docker compose up -d --no-deps app; then
    rollback_app || true
    fail 'candidate application failed to start'
fi

elapsed=0
healthy=false
while [ "$elapsed" -lt "$HEALTH_TIMEOUT" ]; do
    app_container=$(docker compose ps -q app 2>/dev/null || true)
    if [ -n "$app_container" ]; then
        state=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$app_container" 2>/dev/null || true)
        if [ "$state" = 'healthy' ]; then
            if [ -z "$HEALTH_URL" ] || curl --fail --silent --show-error "$HEALTH_URL" >/dev/null; then
                healthy=true
                break
            fi
        fi
        [ "$state" != 'unhealthy' ] || break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
done

if [ "$healthy" != true ]; then
    rollback_app || true
    fail "health gate did not pass within ${HEALTH_TIMEOUT}s"
fi

if [ -n "$rollback_ref" ]; then docker image rm "$rollback_ref" >/dev/null 2>&1 || true; fi
say "Deployment succeeded: $old_revision -> $new_revision"
say "Pre-deploy backup: $backup_path"
