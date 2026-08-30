# Quickstart: 대화 아바타 배포 준비 검증

이 문서는 구현이 끝난 배포 후보를 검증하는 실행 가이드다. 운영 DB나 현재 행사
Compose project를 테스트 대상으로 쓰지 않는다. 새 설치와 업그레이드는 서로 다른
고유 project name과 전용 DB/volume에서 실행한다.

## 1. 준비

- Git
- Node.js 22.13 이상과 `npm ci`
- Docker Engine, Docker Compose v2
- Playwright Chromium
- 테스트 전용 PostgreSQL 연결 문자열 `TEST_DATABASE_URL`
- 승인 별칭이 들어 있는 민감정보 없는 테스트 프로필 fixture

검증할 기준선과 후보 SHA를 먼저 고정한다. 아래 값은 실제 40자 SHA로 바꾼다.

```bash
baseline_sha='<codex/mvp-core-flow SHA>'
candidate_sha='<codex/conversation-avatar candidate SHA>'
```

후보 브랜치에서 두 SHA가 존재하고 후보가 기준선을 포함하는지 확인한다.

```bash
git cat-file -e "${baseline_sha}^{commit}"
git cat-file -e "${candidate_sha}^{commit}"
git merge-base --is-ancestor "$baseline_sha" "$candidate_sha"
```

## 2. 전달 가능한 변경 집합 확인

후보 commit을 새 폴더에 clone한다. 로컬 저장소를 시험할 때도 `--no-local`을 사용하면
작업 트리의 미추적 파일을 우연히 참조하지 않는다.

```bash
validation_dir=$(mktemp -d)
git clone --no-local . "$validation_dir/repo"
cd "$validation_dir/repo"
git checkout --detach "$candidate_sha"
```

작업 트리와 필수 파일을 확인한다.

```bash
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git ls-files --error-unmatch \
  db/migrations/0002_presenter_results.sql \
  db/migrations/0003_conversation_profiles.sql \
  specs/003-conversation-avatar/spec.md \
  specs/004-conversation-avatar-readiness/spec.md \
  scripts/analyze_kakao_profiles.py \
  scripts/import-conversation-profiles.ts
```

다음 조건은 반드시 눈으로도 확인한다.

- `db/migrations/`에는 서로 다른 `0002`가 없다.
- journal 순서는 `0001_event_core`, `0002_presenter_results`,
  `0003_conversation_profiles`다.
- `.env`, 실제 분석 JSON, 실제 닉네임·user ID 별칭 파일, DB dump가 Git에 없다.
- `package-lock.json`과 `package.json`이 같은 의존성 집합을 가리킨다.

## 3. 정적·단위 검증

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm test
npm run test:analysis
```

모든 명령이 종료 코드 0이어야 한다. 분석 테스트는 원문과 실제 user ID가 없는 임시
SQLite fixture만 사용해야 한다.

## 4. PostgreSQL 통합 검증

`TEST_DATABASE_URL`은 삭제 가능한 전용 테스트 DB만 가리켜야 한다. 테스트 helper는
schema를 재생성하므로 운영 DB 주소를 넣으면 안 된다.

```bash
export TEST_DATABASE_URL='postgresql://test_user:test_password@127.0.0.1:5432/frontend_chat_avatar_test'
npm run test:integration
```

최소한 아래 자동 시나리오가 포함되어야 한다.

1. 정식 닉네임과 승인 별칭이 가입·로그인·PIN 초기화에서 같은 participant ID를 돌려준다.
2. 별칭 PIN 초기화 전후 answer ID와 current avatar ID가 같다.
3. 승인되지 않은 이름과 충돌 이름은 같은 외부 오류이고 어떤 PIN도 바뀌지 않는다.
4. 같은 미승인 닉네임 반복 요청에서는 Argon2 mock 호출이 0회이고 허용 횟수 뒤 429가 된다.
5. 승인 닉네임도 같은 출처·닉네임의 허용 횟수 뒤 429, `Retry-After`, `retryAfterSeconds`가 함께 온다.
6. 제한된 요청은 Argon2를 실행하지 않고, 다른 닉네임 참가자 20명은 전원 가입한다.
7. 대화 아바타 참가자의 답변을 발표하면 진행자와 프로젝터 snapshot에 같은 traits가 남는다.

## 5. 브라우저와 접근성 검증

테스트 DB에 fixture를 import하고 앱을 실행한 뒤 별도 터미널에서 Playwright를 실행한다.

```bash
npm run avatar:validate -- tests/fixtures/avatar-analysis/valid-all-participants.json
npm run avatar:import -- tests/fixtures/avatar-analysis/valid-all-participants.json
npm run dev
```

```bash
export PLAYWRIGHT_BASE_URL='http://127.0.0.1:3000'
npm run test:e2e
```

자동 검증은 아래 결과를 증명해야 한다.

- 360px에서 가입, 로비, 답변, 로그아웃, 별칭 재로그인과 PIN 복구가 끝난다.
- `page.emulateMedia({ reducedMotion: 'reduce' })` 공개를 20회 반복해 후보 문구가 교체되지
  않고 매번 1초 안에 확정 프로필이 보인다.
- 일반 공개 중 새로고침·재접속을 20회 반복해도 participant와 확정 avatar assignment가
  각각 하나다.
- 후보 컨테이너는 접근성 트리에서 제외되고 `role=status` 텍스트는 준비·완료만 담는다.
- live region의 DOM 변경 횟수는 준비와 완료 각각 한 번 이하이며 후보 class/item/status/hash는
  한 번도 들어가지 않는다.
- 셔플 중 임시 개발자 카드는 tab 순서에 없고, 확정 카드는 키보드로 상태 변경이 가능하다.
- 기존 `/admin/presenter`와 `/admin/presenter/screen` 흐름이 그대로 동작한다.

자동 검증 뒤 NVDA 또는 실제 사용하는 스크린리더로 가입 1회를 실행한다. 준비와 완료가
각각 한 번 이하로 들리고 후보가 반복 낭독되지 않는지 확인해 검증 기록에 결과만 남긴다.
실제 닉네임이나 읽힌 프로필 문구 전문은 기록하지 않는다.

## 6. 깨끗한 Compose 새 설치 3회

clone한 후보에 `.env.example`을 복사하고 검증 전용 비밀값과 포트를 넣는다. 값을 콘솔이나
검증 JSON에 남기지 않는다. 회차마다 `avatar-clean-1`, `avatar-clean-2`,
`avatar-clean-3`처럼 다른 project name을 쓴다.

```bash
cp .env.example .env
chmod 600 .env
docker compose -p avatar-clean-1 config --quiet
docker compose -p avatar-clean-1 up -d --build
docker compose -p avatar-clean-1 ps -a
curl -fsS http://127.0.0.1:3000/api/health
```

각 회차에서 다음을 확인한다.

- 설치 시작부터 대표 UI 확인까지 30분 안에 끝난다.
- migrate가 0으로 끝나고 app과 db가 healthy다.
- `0001 → 0002 → 0003`으로 필요한 테이블이 한 번씩 생성된다.
- fixture import 뒤 승인 별칭 가입과 관리자 프로필 현황이 동작한다.
- 진행자와 프로젝터 페이지가 열리고 기존 답변 공개 흐름이 동작한다.
- 같은 candidate에서 migration을 한 번 더 실행해도 중복 테이블·프로필이 생기지 않는다.

검증 전용 project를 정리할 때는 이름을 다시 확인한다. `down -v`는 그 project의 DB를
삭제하므로 운영 project 이름에는 절대 사용하지 않는다.

```bash
docker compose -p avatar-clean-1 down -v
```

## 7. 기존 `0002` DB 업그레이드 3회

별도 clone과 `avatar-upgrade-1` project를 만든다. 먼저 기준선 SHA에서 서비스를 띄우고
데모 참가자·답변을 준비한 뒤, 진행자 화면에서 발표 항목과 작성자 공개 상태를 하나 만든다.

```bash
git checkout --detach "$baseline_sha"
docker compose -p avatar-upgrade-1 up -d --build
docker compose -p avatar-upgrade-1 run --rm \
  -e ALLOW_DEMO_SEED=true -e DEMO_PARTICIPANT_PIN=123456 \
  migrate sh -c 'npm run db:seed:demo'
```

참가자·답변·발표 session/item 수와 현재 발표 revision을 기록한다. 답변 전문과 닉네임은
기록하지 않는다. 그다음 기존 배포 스크립트와 같은 방식으로 custom-format backup을 만들고
`pg_restore --list` 검사를 통과시킨다.

후보 SHA로 전환해 `0003`을 적용한다.

```bash
git checkout --detach "$candidate_sha"
docker compose -p avatar-upgrade-1 build app
docker compose -p avatar-upgrade-1 run --rm migrate
docker compose -p avatar-upgrade-1 up -d --no-deps app
docker compose -p avatar-upgrade-1 ps -a
```

적용 뒤 아래를 확인한다.

- 참가자·답변·발표 session/item 수가 적용 전과 같다.
- 현재 발표 항목, revision, 작성자 공개 상태가 유지된다.
- `0003` 대화 프로필 구조와 `participant_register` action을 사용할 수 있다.
- fixture import와 별칭 가입·PIN 복구가 성공한다.
- 기존 진행자 E2E와 새 대화 아바타 E2E가 함께 통과한다.
- migration 재실행 뒤에도 결과가 같다.

`avatar-upgrade-2`, `avatar-upgrade-3`에서도 새 volume으로 같은 절차를 반복한다. 한 회차의
volume을 초기화해 세 번으로 세지 않는다.

## 8. 검증 기록과 최종 게이트

각 clean/upgrade 회차 결과는
[deployment-validation.schema.json](./contracts/deployment-validation.schema.json)에 맞춘다.
API 동작은 [openapi.yaml](./contracts/openapi.yaml)을 기준으로 확인한다.

최종 배포 후보는 다음 조건을 전부 만족해야 한다.

- clean-install 3건, existing-upgrade 3건의 record가 모두 `pass`다.
- lint, typecheck, build, unit, analysis, integration, E2E가 전부 통과한다.
- 별칭 PIN 복구, 가입 제한, reduced motion, live region, 진행자 회귀가 통과한다.
- 후보 clone에서 `git status --porcelain=v1 --untracked-files=all`이 비어 있다.
- branch가 upstream에 있고 다른 작업자가 같은 SHA를 clone할 수 있다.
- `docs/DEPLOYMENT.md`에 새 설치, 기존 서버 갱신, backup·restore, migration 실패 뒤 재시도,
  대화 프로필 import 절차가 분리되어 있다.
