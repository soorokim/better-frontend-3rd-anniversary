# 배포 안내서

이 문서는 새 서버에서 저장소를 받아 처음 실행하는 과정부터 업데이트와 데이터 복구까지 이어서 설명한다. 설치와 업데이트 예시는 Linux 서버 기준이고, 백업·복구 스크립트는 PowerShell 7.2 이상에서 Windows와 Linux 모두 실행할 수 있다.

## 1. 준비할 것

- Git
- Docker Engine과 `docker compose` 명령을 제공하는 Compose v2
- HTTP LAN 설치라면 앱 포트에 접근할 수 있는 내부 IP
- HTTPS 설치라면 서버를 가리키는 DNS 레코드와 외부 80·443 TCP 포트, 443 UDP 포트

저장소의 `compose.yaml`은 PostgreSQL 포트를 호스트에 열지 않는다. 앱만 `APP_PORT`로 공개하며, `https` 프로필을 켜면 Caddy가 80·443 포트를 받아 앱으로 전달한다.

## 2. 저장소와 환경 변수 준비

```bash
git clone https://github.com/soorokim/better-frontend-3rd-anniversary.git
cd better-frontend-3rd-anniversary
cp .env.example .env
mkdir -p backups
```

`.env`는 Git에 포함되지 않는다. 파일 권한도 운영 계정만 읽도록 줄이는 편이 좋다.

```bash
chmod 600 .env
```

다음 값을 실제 설치에 맞게 바꾼다.

| 변수 | 설정 기준 |
| --- | --- |
| `NODE_ENV` | 운영에서는 `production` |
| `APP_ORIGIN` | 브라우저가 실제로 접속할 origin. 경로와 마지막 `/` 없이 `http://192.0.2.10:3000` 또는 `https://event.example.com` |
| `APP_PORT` | HTTP LAN에서 호스트에 열 앱 포트. 생략하면 `3000` |
| `POSTGRES_DB`, `POSTGRES_USER` | 새 설치 전에만 정한다. 기본값은 둘 다 `frontend_chat` |
| `POSTGRES_PASSWORD` | 길고 무작위인 DB 비밀번호. `DATABASE_URL`의 비밀번호도 같은 값으로 맞춘다 |
| `DATABASE_URL` | Docker 밖의 개발 도구용 연결 문자열. Compose 서비스는 같은 항목을 내부 DB 주소로 덮어쓴다 |
| `AUTH_PEPPER` | 32자 이상 무작위 값. PIN·초대 코드 등의 해시에 쓰므로 설치 뒤 보존한다 |
| `SESSION_SECRET` | 32자 이상 무작위 값. 바꾸면 기존 세션이 유효하지 않게 된다 |
| `INVITE_CODE` | 참가자에게만 공유할 16자 이상 코드 |
| `ADMIN_USERNAME` | 최초 관리자 아이디 |
| `ADMIN_PASSWORD` | 최초 관리자 비밀번호, 15자 이상 |
| `EVENT_SLUG` | 행사 내부 식별자, 80자 이하. 운영 중 바꾸면 다른 행사로 취급될 수 있다 |
| `EVENT_TITLE` | 화면에 표시할 행사명, 100자 이하 |
| `EVENT_QUESTION` | 최초로 공개할 질문, 1~500자 |
| `APP_DOMAIN` | Caddy HTTPS 설치에서 사용할 공개 도메인 |

무작위 값은 서버에서 만들 수 있다. PostgreSQL 비밀번호는 연결 문자열에서도 안전하게 쓸 수 있도록 무작위 16진수처럼 URL 인코딩이 필요 없는 형태가 편하다. 생성 결과는 화면이나 셸 기록에 오래 남기지 말고 바로 비밀번호 관리 도구로 옮긴다.

```bash
openssl rand -hex 32
```

`docker compose config`는 치환된 비밀값까지 출력할 수 있다. 운영 로그나 채팅에 그 출력을 붙이지 않는다. 문법 확인만 할 때는 다음처럼 조용히 검사한다.

```bash
docker compose config --quiet
```

## 3. HTTP LAN으로 실행

도메인이 없고 행사장 내부 네트워크에서만 쓴다면 `.env`를 아래 원칙으로 둔다.

```dotenv
NODE_ENV=production
APP_ORIGIN=http://192.0.2.10:3000
APP_PORT=3000
```

`192.0.2.10`은 예시 주소이므로 서버의 실제 LAN IP로 바꾼다. `APP_ORIGIN`이 브라우저 주소와 다르면 Origin 검사와 쿠키 동작이 깨질 수 있다.

```bash
docker compose up -d --build
docker compose ps -a
docker compose logs migrate
curl -fsS http://127.0.0.1:3000/api/health
```

처음 실행할 때 흐름은 `db` healthy → `migrate`가 마이그레이션과 시드를 마치고 정상 종료 → `app` healthy 순서다. `migrate`가 `Exited (0)`으로 보이는 것은 정상이다. 앱과 DB는 계속 실행 중이어야 한다.

방화벽에는 필요한 LAN 대역에서 `APP_PORT`만 허용한다. PostgreSQL 5432 포트를 따로 열 필요가 없다.

HTTP 설치는 내부 시험과 행사장 LAN 용도다. 쿠키는 HTTP에서 작동하도록 이름과 `Secure` 정책을 조정하지만, 네트워크 구간이 암호화되지는 않는다. 인터넷에 공개할 때는 HTTPS 구성을 쓴다.

## 4. Caddy로 HTTPS 실행

공개 DNS의 A/AAAA 레코드를 서버로 연결하고 `.env`를 맞춘다.

```dotenv
NODE_ENV=production
APP_ORIGIN=https://event.example.com
APP_DOMAIN=event.example.com
```

`APP_DOMAIN`에는 스킴이나 경로를 쓰지 않는다. 서버의 80·443 TCP, 443 UDP가 Caddy까지 들어와야 인증서가 자동 발급된다.

```bash
docker compose --profile https up -d --build
docker compose ps -a
docker compose logs caddy
curl -fsS https://event.example.com/api/health
```

HTTPS에서는 세션 쿠키가 `Secure`와 `__Host-` 이름을 사용하고, HSTS와 `upgrade-insecure-requests` 보안 정책이 추가된다. HTTP LAN 설정으로 만들었던 브라우저 세션은 HTTPS 전환 뒤 다시 로그인하는 것이 자연스럽다.

호스트 3000 포트도 기본적으로 계속 바인딩된다. 인터넷 공개 서버라면 방화벽에서 3000을 외부에 허용하지 않거나 Compose의 포트 바인딩을 내부 인터페이스로 제한하고, 외부 요청은 Caddy의 80·443으로만 받는다.

## 5. 최초 관리자 초기화

빈 데이터베이스의 첫 실행에서 `migrate` 서비스가 다음 작업을 한다.

1. 마이그레이션 적용
2. `EVENT_SLUG`에 해당하는 행사 생성
3. `ADMIN_USERNAME`과 `ADMIN_PASSWORD`로 관리자 생성
4. `EVENT_QUESTION`으로 첫 질문 생성

관리자 로그인 주소는 `/admin/login`이다. 배포 직후 로그인하고 참가자 목록이 열리는지 확인한다.

시드는 반복 실행해도 기존 관리자 계정을 덮어쓰지 않는다. 그래서 `.env`의 `ADMIN_PASSWORD`를 바꾸고 `docker compose up` 또는 `npm run db:seed`를 다시 실행하는 것만으로 기존 비밀번호가 변경되지 않는다. 현재 저장소에는 운영 중 관리자 비밀번호를 회전하거나 분실 계정을 자동 복구하는 검증된 명령이 없다. DB를 직접 수정하지 말고, 이 기능이 추가되기 전에는 최초 비밀번호를 비밀번호 관리 도구에 안전하게 보관한다.

## 6. 배포 확인

```bash
docker compose ps -a
curl -fsS http://127.0.0.1:3000/api/health
docker compose logs --tail=100 app
```

HTTPS 구성은 마지막 URL을 공개 도메인으로 바꾼다. 기대하는 상태는 다음과 같다.

- `db`: `Up ... (healthy)`
- `migrate`: `Exited (0)`
- `app`: `Up ... (healthy)`
- `caddy`: HTTPS 프로필을 쓴 경우 실행 중
- 헬스 응답: `{"status":"ok"}`

브라우저에서는 참가자 `/`, 관리자 `/admin/login`을 각각 연다. 잘못된 초대 코드로 데이터가 생기지 않는지, 올바른 코드로 등록·로그아웃·재로그인이 되는지, 답변을 저장하고 새로고침해도 남는지까지 확인한다.

응답 헤더도 한 번 확인해 두면 설정 실수를 빨리 찾을 수 있다.

```bash
curl -sS -D - -o /dev/null http://127.0.0.1:3000/
curl -sS -D - -o /dev/null http://127.0.0.1:3000/api/health
```

모든 응답에는 CSP, `X-Content-Type-Options`, frame 차단, referrer·permissions 정책이 있어야 한다. API에는 `Cache-Control: no-store, private`가 붙는다. HSTS와 CSP의 HTTP 업그레이드 지시는 `APP_ORIGIN`이 HTTPS일 때만 나오는 것이 정상이다.

## 7. 업데이트

업데이트 전에 앱과 DB가 healthy인지 확인한다. 서버 checkout은 upstream이 연결된 브랜치에 있어야 하고, `.env`가 있어야 하며, Git 작업 트리는 추적되지 않은 파일까지 깨끗해야 한다. `.env`와 `backups/`는 원래 `.gitignore`에 포함되므로 작업 트리를 더럽히지 않는다.

```bash
sh scripts/deploy.sh
```

이 스크립트는 동시에 두 번 실행되지 않도록 잠그고 다음 순서로 작업한다.

1. 현재 브랜치를 `git pull --ff-only`로 갱신한다.
2. 후보 앱 이미지를 빌드한다. 이 단계까지 실패하면 실행 중인 앱은 건드리지 않는다.
3. custom format DB 백업을 만들고 `pg_restore --list`로 읽을 수 있는지 확인한다.
4. 마이그레이션과 시드를 실행한다.
5. 후보 앱을 올리고 컨테이너 health를 최대 120초 기다린다. `DEPLOY_HEALTH_URL`을 지정했다면 해당 주소의 HTTP 검사도 함께 통과해야 한다.

백업 위치와 헬스 URL, 제한 시간은 실행 환경 변수로 바꿀 수 있다.

```bash
DEPLOY_BACKUP_DIR=/srv/event-backups \
DEPLOY_HEALTH_URL=https://event.example.com/api/health \
DEPLOY_HEALTH_TIMEOUT=180 \
sh scripts/deploy.sh
```

후보 앱의 health gate가 실패하면 가능할 때 이전 앱 이미지로 되돌린다. 이미 적용한 DB 마이그레이션은 자동으로 되돌리지 않는다. 스크립트가 출력한 배포 직전 백업 경로를 보존하고, 앱 로그와 마이그레이션 호환성을 확인한 뒤 복구 여부를 결정한다.

스크립트를 쓰지 못하는 환경에서만 아래 수동 흐름을 쓴다. 먼저 별도 백업을 만들고 시작한다.

```bash
git status --short
git pull --ff-only
docker compose config --quiet
docker compose up -d --build
docker compose ps -a
curl -fsS http://127.0.0.1:3000/api/health
```

서버 checkout에 직접 수정한 파일이 있으면 `git pull --ff-only`가 멈출 수 있다. 그 변경을 억지로 지우지 말고 별도 커밋이나 백업으로 보존한 다음 원인을 확인한다. `.env`, DB volume, `backups/`는 Git 업데이트 대상이 아니다.

새 버전에서 마이그레이션이 실패하면 앱도 시작되지 않는다. `docker compose logs migrate`를 먼저 보고, 실패한 상태에서 반복 재시작하거나 volume을 지우지 않는다. 복구가 필요하면 업데이트 직전 백업으로 별도 DB에서 먼저 검증한다.

## 8. 백업과 복구

백업 대상은 PostgreSQL 데이터다. `.env`도 별도의 암호화된 비밀 저장소에 보관해야 새 서버에서 같은 설정을 재현할 수 있다. 백업 파일은 서버 디스크 한 곳에만 두지 말고 서버 밖에도 복사한다.

기본 백업은 실행 중인 Compose `db`를 찾아 DB 이름과 사용자를 컨테이너에서 읽는다. custom format dump를 만든 뒤 `pg_restore --list` 검사를 통과하고 크기가 0이 아닌 경우에만 `.dump`로 확정한다. 기본 보관 위치는 `backups/`이며, 기본값으로 기존 백업을 자동 삭제하지 않는다.

```powershell
pwsh ./scripts/backup.ps1
pwsh ./scripts/backup.ps1 -DestinationDirectory /srv/event-backups -RetentionDays 30
```

성공하면 만들어진 백업의 절대 경로가 출력된다. `RetentionDays`를 양수로 명시하면 같은 대상 폴더의 오래된 `*.dump`도 정리하므로 이 서비스 전용 폴더를 지정한다. 다른 이름의 DB를 백업할 때만 `-DatabaseName`과 `-DatabaseUser`를 명시한다. 스크립트가 파일 권한을 현재 운영 계정 중심으로 제한하지만, 결과는 서버 밖의 암호화된 저장소에도 복사한다.

스크립트를 저장소 밖에서 실행한다면 `-ComposeDirectory`로 `compose.yaml`이 있는 폴더를 지정한다.

복구 명령에는 백업 파일, 대상 DB, 그리고 `RESTORE <대상 DB>`와 정확히 일치하는 확인 문구가 모두 필요하다. 먼저 운영 DB가 아닌 새 검증 DB로 실행한다.

```powershell
pwsh ./scripts/restore.ps1 `
  -BackupFile ./backups/frontend_chat-YYYYMMDDTHHMMSSZ-XXXXXXXX.dump `
  -TargetDatabase restore_check `
  -Confirmation 'RESTORE restore_check'
```

대상 DB가 이미 있으면 복구 전에 `backups/pre-restore/`에 안전 백업을 하나 더 만든다. 위치를 바꾸려면 `-PreRestoreBackupDirectory`를 쓴다. 대상이 현재 운영 DB라면 앱 쓰기를 멈추고 연결을 종료한 뒤 대상 DB를 다시 만들어 single-transaction으로 복구한다. 끝나면 앱을 다시 올려 최대 120초 동안 healthy 상태를 확인한다. 복구가 실패하면 불완전하게 새로 만든 대상 DB를 정리하고, 기존 DB의 pre-restore 백업 경로를 오류에 남긴다. PostgreSQL의 `postgres`, `template0`, `template1`은 복구 대상으로 지정할 수 없다. Docker volume 자체를 임의로 삭제하지 않는다.

운영 복구 명령은 점검 시간과 최신 백업을 확정한 뒤에만 실행한다. 예를 들어 실제 DB 이름이 `frontend_chat`이라면 확인 문구도 대소문자를 포함해 정확히 `RESTORE frontend_chat`이어야 한다.

PowerShell을 설치할 수 없는 환경에서는 다음 Compose 명령으로 custom format dump를 수동 생성하고 읽기 검사까지 한다.

```bash
mkdir -p backups
event_backup_path="backups/event-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$event_backup_path"
test -s "$event_backup_path"
docker compose exec -T db pg_restore --list < "$event_backup_path" > /dev/null
```

수동 복구도 데이터를 덮어쓸 수 있는 작업이다. 운영 DB에 곧바로 넣지 말고 새 빈 검증 DB에서 dump가 읽히는지 확인한다.

```bash
docker compose exec -T db createdb -U frontend_chat restore_check
docker compose exec -T db pg_restore -U frontend_chat -d restore_check --clean --if-exists < backups/event-YYYYMMDD-HHMMSS.dump
```

`frontend_chat`은 실제 `POSTGRES_USER`로, dump 파일명은 복구할 정확한 파일로 바꾼다. 복구 DB에서 참가자 수, 답변 수, 아바타 연결 수를 원본과 비교하고 애플리케이션 검증까지 마친 뒤에만 운영 복구 일정을 잡는다. 기존 운영 volume 삭제는 복구 절차에 포함되지 않는다.

검증 DB가 더 이상 필요 없을 때만 정확한 이름을 확인하고 제거한다.

```bash
docker compose exec -T db dropdb -U frontend_chat restore_check
```

## 9. 장애 대응

### 앱이 시작되지 않는다

```bash
docker compose ps -a
docker compose logs --tail=200 migrate
docker compose logs --tail=200 app
```

환경 변수 길이, `APP_ORIGIN` URL 형식, DB 비밀번호 일치 여부를 확인한다. `.env` 값을 로그에 그대로 출력하지 않는다. `migrate`가 0으로 끝나지 않았다면 그 오류가 먼저다.

### DB가 unhealthy다

```bash
docker compose logs --tail=200 db
docker compose exec db pg_isready -U frontend_chat -d frontend_chat
docker system df
```

사용자·DB 이름은 `.env` 값으로 바꾼다. 디스크 부족과 volume 권한, 기존 volume을 만든 시점의 DB 자격 정보가 현재 `.env`와 다른지 확인한다. PostgreSQL volume은 최초 생성 시 자격 정보를 고정하므로 `.env`만 바꿔서는 기존 DB 사용자가 바뀌지 않는다. 해결을 위해 volume을 삭제하면 데이터도 사라지므로 하지 않는다.

### 헬스체크가 503이다

`/api/health`의 503은 앱 프로세스는 응답하지만 DB 확인이 실패했다는 뜻이다. `db` 상태와 앱의 DB 연결 오류를 같이 본다. 일시적인 재시작보다 원인을 확인하고, 운영 데이터를 보존한 채 백업 가능 여부부터 판단한다.

### 로그인이나 저장이 전부 실패한다

브라우저 주소의 origin과 `APP_ORIGIN`이 정확히 같은지 확인한다. `http`/`https`, 포트 하나가 달라도 다른 origin이다. HTTPS 전환 뒤에는 기존 탭을 닫고 새로 로그인한다. 서버 시각이 크게 어긋나면 세션과 PIN 초기화 코드 만료에도 영향을 준다.

### Caddy 인증서가 나오지 않는다

```bash
docker compose logs --tail=200 caddy
```

DNS가 현재 서버를 가리키는지, 80·443 포트가 라우터와 방화벽을 지나 Caddy까지 도달하는지, `APP_DOMAIN`에 스킴이나 경로가 섞이지 않았는지 확인한다. 내부 IP나 `.local` 이름에는 공개 인증서가 발급되지 않으므로 그런 환경에서는 HTTP LAN 구성을 쓴다.

### 관리자 비밀번호를 잃어버렸다

현재는 검증된 자동 복구 절차가 없다. `.env` 변경과 재시드는 기존 계정을 갱신하지 않는다. 운영 DB를 임의 SQL로 고치지 말고, 보관한 최초 비밀번호를 확인하거나 비밀번호 회전 기능이 구현된 버전으로 계획된 업데이트를 진행한다.

## 10. 중지와 재시작

```bash
docker compose stop
docker compose start
```

이미지를 다시 만들 필요가 있으면 `docker compose up -d --build`를 쓴다. `docker compose down`은 컨테이너와 네트워크를 내리지만 named volume은 유지한다. 그래도 운영에서는 중지·재시작에 `stop`과 `start`를 우선 쓴다. `down -v`, volume prune, named volume 삭제는 DB 데이터를 지우므로 실행하지 않는다.
