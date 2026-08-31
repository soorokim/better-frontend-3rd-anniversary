# 프론트엔드 단톡방 3주년

공통 초대 코드로 입장한 참가자가 단톡방에서 사용한 승인 닉네임과 PIN을 만들고, 미리 분석한 대화 특징으로 고정 픽셀 캐릭터와 개발자 프로필을 받아 3주년 질문에 답하는 작은 행사 서비스다. 다시 로그인하면 같은 캐릭터와 기존 답변을 불러와 수정할 수 있고, 진행자는 관리자 화면에서 참가자와 제출 여부, 대화 프로필 준비 상태를 확인하고 PIN 초기화 코드를 발급하거나 테스트 계정을 삭제할 수 있다.

현재 데이터베이스 마이그레이션 계보는 `0001_event_core → 0002_presenter_results → 0003_conversation_profiles`다. 새 설치와 `0002`까지 적용된 기존 설치의 갱신을 모두 지원한다. 기존 마이그레이션의 이름이나 내용을 바꾸지 말고, 이후 변경은 새 번호의 전진 마이그레이션으로 추가한다.

## 바로 실행하기

필요한 것은 Git, Docker Engine, Docker Compose v2다. Node.js는 Docker 밖에서 실행할 때만 필요하며 그 경우 22.13 이상을 사용한다.

```bash
git clone https://github.com/soorokim/better-frontend-3rd-anniversary.git
cd better-frontend-3rd-anniversary
cp .env.example .env
```

`.env`의 `change-me`, `replace-with-...` 값을 전부 바꾼다. 최소한 `NODE_ENV=production`, 접속 주소와 정확히 같은 `APP_ORIGIN`, PostgreSQL 비밀번호, 32자 이상의 `AUTH_PEPPER`·`SESSION_SECRET`, 16자 이상의 초대 코드, 15자 이상의 관리자 비밀번호, 행사 질문을 설정해야 한다.

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps -a
curl -fsS http://localhost:3000/api/health
```

정상이라면 `db`와 `app`은 `healthy`, 일회성 `migrate` 서비스는 `Exited (0)`으로 표시되고 마지막 요청은 `{"status":"ok"}`를 반환한다. 참가자 화면은 `/`, 관리자 로그인은 `/admin/login`이다. 문제가 생기면 먼저 `docker compose logs migrate`와 `docker compose logs app`을 확인한다.

## 기존 서버 업데이트

운영 데이터가 있는 서버에서는 `docker compose down -v`를 실행하거나 PostgreSQL volume을 직접 지우지 않는다. 작업 트리가 깨끗하고 현재 앱과 DB가 정상인 상태에서 아래 배포 스크립트를 사용한다.

```bash
git status --short
git pull --ff-only
sh scripts/deploy.sh
```

이 스크립트는 배포 직전 DB 백업을 만들고 검사한 뒤, 새 설치와 같은 migration runner로 `0003`까지 적용하고 앱 health를 확인한다. 마이그레이션이 실패하면 기존 앱을 그대로 두며 출력된 백업 경로를 알려 준다. 상세한 환경 변수, HTTPS, 수동 백업·복구와 장애 대응은 [배포 안내서](docs/DEPLOYMENT.md)를 따른다.

## AI 작업자에게 설치를 맡길 때

저장소만 전달받은 작업자는 다음 순서로 진행하면 된다.

1. 이 README와 [배포 안내서](docs/DEPLOYMENT.md)를 먼저 읽는다.
2. `.env.example`을 `.env`로 복사하고 placeholder와 실제 접속 origin을 교체한다. 비밀 값은 채팅, 로그, Git에 남기지 않는다.
3. `docker compose config --quiet`로 설정을 검사한다.
4. 새 서버는 `docker compose up -d --build`, 기존 서버는 `sh scripts/deploy.sh`를 사용한다.
5. `migrate`의 정상 종료, `db`·`app` health, `/api/health` 응답을 확인한 뒤에만 설치 완료로 판단한다.

운영 DB를 시험 대상으로 쓰지 않는다. 데모 데이터나 migration 검증이 필요하면 별도의 이름에 `test`가 포함된 삭제 가능한 DB 또는 고유한 Compose project를 만든다.

## 행사에서 답변 발표하기

관리자로 로그인한 뒤 `/admin`의 **답변 발표 진행하기**를 누르면 `/admin/presenter`가 열린다. 이 화면은 진행자 노트북에 두고, **발표 화면 새 창으로 열기**로 연 `/admin/presenter/screen`만 프로젝터에 띄운다. 발표 화면 오른쪽 위의 **전체 화면**을 눌러 두면 참가자 목록이나 조작 버튼 없이 질문과 현재 답변만 보인다.

답변은 목록에서 직접 고르거나 아직 공개하지 않은 답변 중 무작위로 고를 수 있다. 새 답변은 진행 중에도 목록에 들어온다. 답변을 처음 띄우면 항상 익명이고, 이야기한 뒤 **작성자 공개**를 눌러 닉네임과 캐릭터를 보여 주는 흐름이 자연스럽다. 이전·다음 이동은 처음 공개한 순서를 따른다.

**발표 기록 초기화**는 한 번 더 확인해야 실행된다. 현재 슬라이드와 공개 순서만 지우며 참가자의 원본 답변, 닉네임, 캐릭터는 지우지 않는다. 행사 중 연결이 잠깐 끊기면 마지막 슬라이드를 그대로 둔 채 자동으로 다시 연결한다. 로그인 만료 안내가 나오면 관리자 로그인을 다시 하고 진행자 화면과 발표 화면을 새로 열면 DB에 저장된 현재 순서와 슬라이드가 복구된다.

`/admin` 참가자 목록의 **삭제**는 확인창을 거쳐 해당 계정의 답변, 세션, 캐릭터를 함께 지우고 대화 프로필을 다시 가입 가능한 상태로 돌린다. 관리자 화면에서는 삭제 내용을 복구할 수 없으므로 실제 행사 데이터라면 먼저 DB 백업을 남긴다. 다른 행사의 참가자 ID는 이 API로 삭제할 수 없다.

도메인 없이 같은 네트워크에서 쓰는 HTTP 설치와 Caddy를 붙인 HTTPS 설치, 백업·복구, 장애 대응도 [배포 안내서](docs/DEPLOYMENT.md)에 정리해 두었다. 운영 데이터를 지우지 않고 복구를 연습하는 절차도 그 문서를 따른다. 운영 도구는 `scripts/deploy.sh`, `scripts/backup.ps1`, `scripts/restore.ps1`에 있으며, 특히 복구 스크립트는 대상 DB와 정확한 확인 문구를 요구한다.

## 개발 검증

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run test:analysis
npm run build
```

통합 테스트와 Playwright는 별도의 테스트 데이터베이스와 실행 중인 앱 설정이 필요하다. 운영 DB URL을 넣어 실행하면 안 된다. 참가자 흐름은 [기본 기능 quickstart](specs/001-event-core-flow/quickstart.md), 진행자 화면은 [발표 기능 quickstart](specs/002-presenter-results/quickstart.md), 현재 통합 검증은 [대화 아바타 준비 quickstart](specs/004-conversation-avatar-readiness/quickstart.md)에 순서가 있다. API 계약은 [기본 기능 OpenAPI](specs/001-event-core-flow/contracts/openapi.yaml)와 [발표 기능 OpenAPI](specs/002-presenter-results/contracts/openapi.yaml)를 참고하면 된다.

## 대화 기반 아바타 준비

신규 가입은 활성 대화 프로필 배치가 있어야 열린다. 카카오 원문이 있는 LXC에서 메시지가 있는 비시스템 사용자 전원을 분석하고, 닉네임 충돌 목록을 사용자 승인으로 정리한 뒤, user ID가 없는 JSON만 행사 서버로 가져온다.

```bash
npm run test:analysis
npm run avatar:validate -- /secure-transfer/profiles.json
npm run avatar:import -- /secure-transfer/profiles.json
```

Node.js를 호스트에 설치하지 않은 Docker 서버에서는 검증된 JSON이 있는 호스트 폴더를 읽기 전용으로 붙여 같은 명령을 실행한다.

```bash
docker compose run --rm \
  -v /srv/avatar-transfer:/secure-transfer:ro \
  migrate sh -c 'npm ci --include=dev && npm run avatar:validate -- /secure-transfer/profiles.json && npm run avatar:import -- /secure-transfer/profiles.json'
```

전체 분석·별칭 승인·백업·import 순서는 [대화 아바타 quickstart](specs/003-conversation-avatar/quickstart.md), 별칭 파일 형식은 [분석 도구 안내](scripts/README.md)에 있다. `AVATAR_HASH_KEY`는 아카이브 LXC에서만 주입하며 앱 컨테이너에는 필요 없다.

## 중요한 운영 메모

- `.env`와 `backups/`는 Git에 커밋하지 않는다.
- `ALLOW_DEMO_SEED=true`에서 실행하는 `npm run db:seed:demo`는 데모 참가자뿐 아니라 로그인에 필요한 데모 대화 프로필 배치도 함께 만든다. 실제 대화 프로필 배치가 활성화된 행사에서는 데모 배치를 만들지 않고 중단한다.
- `AUTH_PEPPER`와 `SESSION_SECRET`은 설치 뒤 함부로 바꾸지 않는다. 기존 인증 정보와 세션에 영향을 준다.
- 최초 시드는 빈 DB에 관리자 계정을 만든다. 이미 생성된 관리자의 비밀번호는 `.env` 변경이나 재시드만으로 바뀌지 않는다.
- 데이터베이스 포트는 Compose에서 호스트에 공개하지 않는다.
- 픽셀 캐릭터는 대화 HMAC에서 확정한 몸·머리·옷·소지품·색상 파츠를 프로젝트 자체 SVG 픽셀 도형으로 겹쳐 렌더링한다. 현재 카탈로그는 1,200가지 조합이며 같은 입력은 다시 접속해도 같은 캐릭터가 된다. 대화 프로필의 `RUBBER DUCK`, `LAPTOP`, `RED ERROR LOG` 등 8개 장비는 캐릭터가 실제로 들고 있는 서로 다른 픽셀 아이템으로 표시된다. 로컬 개발에서는 `/avatar-lab`에서 대표 조합과 레이어 정렬을 볼 수 있고, 빌드된 개발 서버는 `AVATAR_LAB_ENABLED=true`일 때만 같은 경로를 연다. 운영 기본값은 `false`라 404로 닫힌다. 기존 `/avatars/pixel-art` 호환 API에는 DiceBear가 남아 있다. 제3자 고지는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있다.
