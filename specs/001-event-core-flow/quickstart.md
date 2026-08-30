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
  통과했다 (`14 passed`).
- Scenario 1의 등록·로그인·로그아웃 계약 테스트와 360px 종단 테스트는 작성했으며,
  타입 검사·lint·운영 빌드는 통과했다.
- 현재 PC의 Docker daemon이 실행 중이 아니고 별도 PostgreSQL도 없어 실제 DB 계약 및
  브라우저 종단 실행은 보류했다. SQLite나 메모리 저장소로 대체하지 않았으며,
  `TEST_DATABASE_URL`을 제공한 PostgreSQL 환경에서 `npm run test:integration`과
  `npm run test:e2e`를 다시 실행해야 Scenario 1을 완료로 판정할 수 있다.
