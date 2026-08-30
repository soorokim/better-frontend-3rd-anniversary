# Quickstart & Validation: 3주년 행사 기본 참여 흐름

이 문서는 구현이 끝났을 때 새 환경에서 설치와 핵심 사용자 흐름을 검증하는 기준이다.
아직 구현되지 않은 명령은 `$speckit-tasks`와 구현 단계에서 실제 package script에 맞춰 확정한다.

## Prerequisites

- Git
- Docker Engine
- Docker Compose v2
- 도메인을 연결할 경우 서버의 80·443 포트와 DNS 설정 권한

로컬 Node.js 설치 없이도 운영 서비스를 실행할 수 있어야 한다. 저장소 내부 개발과 테스트는
`package.json`에 지정된 Node.js 22 환경을 사용한다.

## Clean Installation Target

```bash
git clone <repository-url>
cd <repository-directory>
cp .env.example .env
mkdir -p secrets backups
```

`.env.example`의 설명에 따라 행사 제목, 도메인, 관리자 이름 같은 비밀이 아닌 값을 설정한다.
다음 비밀 파일은 저장소에 커밋하지 않는다.

```text
secrets/postgres_password
secrets/invite_code
secrets/auth_pepper
secrets/admin_password
```

각 파일에는 해당 원문 값 하나와 마지막 줄바꿈만 둔다. 초대 코드는 16자 이상의 무작위 값,
관리자 비밀번호는 15자 이상의 무작위 값이어야 한다.

```bash
docker compose config
docker compose up -d --build
docker compose ps
```

기대 결과:

- `db`가 healthy가 된다.
- `migrate`가 성공 코드로 종료된다.
- `app`과 선택한 `caddy` 서비스가 실행 상태가 된다.
- `GET /api/health`가 `{"status":"ok"}`를 반환한다.
- 데이터베이스 포트는 외부 네트워크에 공개되지 않는다.

## Development Validation Target

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run build
```

모든 명령은 새 checkout에서 추가 수동 설정 없이 실행되어야 한다. 통합·종단 테스트용
데이터베이스는 운영 volume과 분리한다.

## Scenario 1: First Entry and Avatar

1. 360px 너비의 모바일 브라우저에서 시작 화면을 연다.
2. 잘못된 초대 코드로 입장하고, 참가자가 다시 시도할 방법을 확인한다.
3. 올바른 초대 코드, 닉네임 `프론트요정`, PIN 6자리를 입력한다.
4. 캐릭터가 생성되고 로비에 도착하는지 확인한다.
5. 로그아웃하고 같은 정보로 다시 입장한다.

기대 결과:

- 첫 입장이 2분 안에 끝난다.
- 잘못된 코드 시 참가자 데이터가 생기지 않는다.
- 재입장 뒤 참가자 ID와 아바타 파츠가 첫 입장과 같다.
- 다른 브라우저에서도 같은 파츠가 표시된다.
- 참가자는 다른 사람의 제출 상태나 관리자 화면을 볼 수 없다.

## Scenario 2: Nickname Boundaries

다음 입력을 단위 테스트와 등록 화면에서 확인한다.

- `  프론트요정  `과 `프론트요정`은 같은 닉네임으로 처리한다.
- 대소문자만 다른 영문 닉네임은 같은 행사에서 중복 등록되지 않는다.
- 완성형 한글과 의미상 같은 조합형 한글은 같은 key와 아바타 입력을 만든다.
- 제어 문자, 양방향 제어 문자, 빈 값, 24 grapheme 초과 입력은 거부한다.
- 같은 골든 입력을 100번 생성해도 아바타 결과가 byte-for-byte 동일하다.

## Scenario 3: Answer Persistence and Recovery

1. 등록된 참가자로 3주년 질문을 연다.
2. 1~1,000자 범위의 답변을 저장한다.
3. 새로고침하고 다시 입장해 기존 내용을 확인한다.
4. 답변을 수정하고 다른 브라우저에서 최신 내용을 확인한다.
5. 저장 요청 중 데이터베이스 연결을 잠시 끊어 실패 상황을 만든다.

기대 결과:

- 로비 상태가 미제출에서 제출 완료로 바뀐다.
- 재입장과 앱 컨테이너 재시작 뒤에도 최신 성공본이 남는다.
- 실패한 저장을 성공으로 표시하지 않는다.
- 작성 중인 텍스트와 마지막 성공본을 구분해 복구할 수 있다.

## Scenario 4: Admin Visibility and Authorization

1. 제출한 참가자와 제출하지 않은 참가자를 각각 만든다.
2. 참가자 세션으로 `/admin`과 관리자 인터페이스에 접근한다.
3. 관리자 계정으로 로그인하고 참가자 목록을 연다.

기대 결과:

- 참가자 세션은 관리자 데이터에 접근할 수 없다.
- 관리자는 닉네임, 캐릭터, 제출 여부만 보며 답변 전문은 보지 않는다.
- 목록의 상태가 실제 답변 존재 여부와 일치한다.
- 잘못된 관리자 로그인 반복에는 점진적 제한과 `Retry-After`가 적용된다.

## Scenario 5: PIN Reset

1. 관리자가 참가자 한 명의 PIN 초기화를 선택한다.
2. 오래된 관리자 인증이면 비밀번호 재확인을 수행한다.
3. 한 번만 표시되는 8자리 reset code를 참가자에게 전달한다.
4. 기존 참가자 화면과 기존 PIN으로 보호된 기능에 접근한다.
5. 초대 코드, 닉네임, reset code로 새 6자리 PIN을 설정한다.
6. 같은 reset code 재사용과 기존 PIN 로그인을 시도한 뒤 새 PIN으로 로그인한다.

기대 결과:

- 초기화 즉시 모든 기존 참가자 세션과 기존 PIN이 무효화된다.
- 코드는 10분 뒤, 5회 실패 뒤, 성공 사용 뒤에는 동작하지 않는다.
- 재발급 시 이전 코드는 즉시 폐기된다.
- 새 PIN 설정 후 일반 로그인으로만 참가자 세션을 얻는다.
- 감사 기록에는 대상과 결과만 남고 비밀값은 남지 않는다.

## Scenario 6: Concurrent Event Use

30개의 서로 다른 참가자 세션이 5분 안에 등록, 로그인, 답변 저장을 겹쳐 수행하도록 한다.

기대 결과:

- 닉네임 중복이 생기지 않는다.
- 참가자와 답변이 서로 바뀌지 않는다.
- 답변 및 캐릭터 손실이 없다.
- 같은 행사장 네트워크를 쓴 정상 참가자가 IP 제한만으로 영구 차단되지 않는다.

## Backup and Restore Gate

운영 공개 전 다음 흐름을 별도 빈 데이터베이스에서 한 번 성공시킨다.

```bash
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > backups/event.dump
docker compose exec -T db createdb -U "$POSTGRES_USER" restore_check
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d restore_check --clean --if-exists < backups/event.dump
```

복구한 데이터베이스에서 참가자 수, 답변 수, 현재 아바타 관계를 원본과 비교한다. 백업 파일은
서버 밖에도 한 벌 보관한다. 실제 구현에서는 비밀번호가 명령 기록에 노출되지 않도록 Compose
secret과 컨테이너 내부 인증 설정을 사용한다.

## Contract References

- 서버 인터페이스: [contracts/openapi.yaml](./contracts/openapi.yaml)
- 저장 구조와 상태 전환: [data-model.md](./data-model.md)
- 요구사항과 성공 기준: [spec.md](./spec.md)

## MVP Validation Record (2026-08-30)

- Scenario 2의 닉네임 정규화 경계와 아바타 100회 재현 테스트는 로컬 단위 테스트에서
  통과했다. Argon2의 플랫폼 간 입력 호환성 회귀 테스트를 포함해 `15 passed`다.
- Debian 12 전용 LXC의 Docker Compose 환경에서 PostgreSQL 17이 healthy가 되고,
  마이그레이션과 시드가 종료 코드 0으로 완료됐으며 앱 헬스체크가
  `{"status":"ok"}`를 반환했다.
- Scenario 1은 실제 PostgreSQL과 서버 앱을 대상으로 360px 모바일 Playwright에서
  등록, 결정적 캐릭터 확인, 로그아웃, 같은 닉네임·PIN 재입장, 같은 캐릭터 재확인까지
  통과했다 (`1 passed`). 검증용 참가자는 완료 뒤 삭제해 참가자 수를 0명으로 복구했다.
- 운영 쿠키는 `__Host-`와 `Secure` 속성을 유지한다. 도메인 연결 전 검증은 SSH 터널의
  localhost origin으로 실행했고, 공개 배포에서는 `APP_ORIGIN`에 실제 HTTPS 도메인을
  지정해야 한다.

## Answer Flow Validation Record (2026-08-30)

- Scenario 3의 API 통합 테스트와 360px Playwright 시나리오를 먼저 작성한 뒤, 구현 전
  타입 검사에서 현재 질문·답변 라우트가 없다는 오류 6건으로 실패하는 것을 확인했다.
- 답변 흐름 구현 뒤 로컬에서 타입 검사, ESLint, 단위 테스트 17건, Next.js 운영 빌드는
  통과했다. 작성 중 내용과 마지막 성공본은 별도 상태로 유지하며, 실패 시 성공 표시 없이
  마지막 성공본을 펼쳐서 확인할 수 있게 했다.
- 운영 DB와 분리한 PostgreSQL 데이터베이스 `frontend_chat_us2_test`에서 통합 테스트
  5개 파일, 11개 테스트가 모두 통과했다. 현재 질문·답변 API, 길이 검증, 소유권,
  동시 upsert, DB 연결 재생성 뒤 조회까지 포함한다.
- 실제 배포 앱을 360px Playwright로 확인한 결과 답변 저장, 새로고침, 로그아웃·재로그인,
  수정, 저장 실패 복구 흐름이 모두 통과했다 (`1 passed`).
- 앱 컨테이너를 재시작하기 전후 답변 수는 `1 → 1`로 유지됐고, 브라우저에서 다시 로그인해
  최신 성공본 `다시 들어와 수정한 기억`을 불러오는 것도 확인했다.
- 검증이 끝난 뒤 종단 테스트 참가자와 격리 테스트 데이터베이스는 모두 정리했다.

## Admin Recovery Validation Record (2026-08-30)

- 관리자 API, PIN 초기화 보안, 360px 복구 흐름 테스트를 구현보다 먼저 작성했다. 첫 타입
  검사에서 관리자 라우트와 PIN 초기화 서비스가 존재하지 않고 관리자 CSRF 쿠키 이름도
  없어서 9건이 실패하는 것을 확인했다.
- 관리자와 참가자 세션을 별도 쿠키로 분리하고, 관리자 세션의 유휴 15분·절대 4시간 정책을
  유지했다. PIN 초기화는 `auth_version` 증가, 기존 PIN 무효화, 모든 참가자 세션 폐기,
  이전 grant 폐기, 10분짜리 8자리 grant 생성을 한 트랜잭션으로 묶었다. 코드는 hash만
  저장하며 5회 실패·성공 사용·재발급 뒤에는 다시 사용할 수 없다.
- 로컬에서 타입 검사, ESLint, 단위 테스트 18건, Next.js 운영 빌드는 통과했다. 관리자
  목록은 닉네임, 캐릭터, 제출 여부, 입장 시각만 반환하며 답변 본문은 조회하지 않는다.
- 운영 데이터와 분리한 PostgreSQL 데이터베이스 `frontend_chat_us3_test`에서 전체 통합
  테스트 8개 파일, 17개 테스트가 모두 통과했다. 배포한 운영 빌드의 20개 라우트가 정상
  생성됐고 앱과 데이터베이스 컨테이너도 healthy 상태를 유지했다.
- 첫 종단 테스트는 Docker 내부 호스트 이름 `app`으로 접속하면서 Chromium의 HTTPS/HSTS
  주소 처리 문제를 만나 참가자 생성 전에 중단됐다. 서비스의 LAN IP로 다시 실행해 실제
  애플리케이션 흐름을 검증했다.
- 재실행 중 PIN 변경 API가 204를 반환한 뒤에도 화면이 연결 오류를 표시하는 문제를 찾았다.
  비동기 처리 뒤 React의 `event.currentTarget`을 다시 사용한 것이 원인이어서 form 요소를
  요청 전에 보관하도록 고쳤고, 같은 문제가 돌아오지 않도록 단위 회귀 테스트를 추가했다.
- 수정본을 배포한 뒤 360px 관리자 복구 종단 테스트가 1건 모두 통과했다. 참가자 세션의
  관리자 화면 접근 거부, 관리자 로그인과 제출 목록, PIN 초기화 코드 발급, 공개 화면의
  새 PIN 설정, 기존 PIN 로그인 실패, 새 PIN 로그인을 한 흐름에서 확인했다.
- 검증용 참가자 2명과 연결된 감사 기록 4개를 정확히 골라 삭제했고, 격리 테스트
  데이터베이스도 제거했다. 정리 뒤에도 운영 앱과 데이터베이스는 healthy 상태다.

## Event Readiness Validation Record (2026-08-30)

- 같은 행사장 IP를 쓰는 참가자 30명의 등록, 로그인, 캐릭터 배정, 답변 저장을 겹쳐
  실행했다. 약 4.7초 안에 끝났고 참가자·캐릭터·답변이 각각 30개씩 정확히 남았으며,
  다른 참가자에게 연결되거나 사라진 기록은 없었다.
- 운영 데이터와 분리한 PostgreSQL에서 전체 통합 테스트 10개 파일, 26개 테스트가 모두
  통과했다. 보안 헤더, Origin·CSRF 경계, 쿠키 속성, 로그 비밀값 제거도 이 묶음에서
  함께 확인했다.
- HTTP LAN 배포에서는 CSP, `nosniff`, frame 차단, referrer·permissions 정책과 API의
  `Cache-Control: no-store, private`가 적용됐다. HTTPS에서만 써야 하는 HSTS와
  `upgrade-insecure-requests`는 나오지 않는 것도 확인했다.
- 배포 앱을 대상으로 360px Playwright 7개를 실행해 키보드 가입·답변 저장, 3px 포커스,
  44px 터치 영역, 텍스트 대비, reduced-motion, 관리자 PIN 복구와 기존 참여 흐름을 모두
  확인했다.
- 테스트가 만든 참가자 4명과 연결된 감사 기록 2개만 정확히 삭제했다. 앱과 DB 컨테이너는
  정리 뒤에도 healthy 상태다. 픽셀 캐릭터는 외부 이미지 파츠가 아닌 자체 HTML/CSS이며,
  현재 배포하는 제3자 UI 에셋이 없다는 점을 `THIRD_PARTY_NOTICES.md`에 기록했다.
