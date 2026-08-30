# Tasks: 3주년 행사 기본 참여 흐름

**Input**: Design documents from `/specs/001-event-core-flow/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml),
[quickstart.md](./quickstart.md)

**Tests**: 헌법과 기능 명세의 독립 검증 기준을 지키기 위해 테스트 작업을 포함한다.
각 스토리의 테스트를 먼저 작성하고 실패를 확인한 뒤 구현한다.

**Organization**: 공통 기반 이후 사용자 스토리별로 완성 가능한 수직 구간을 만든다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 미완료 작업과 파일 충돌 없이 병렬 실행 가능
- **[Story]**: 명세의 사용자 스토리와 연결되는 작업
- 모든 작업은 수정하거나 생성할 정확한 파일 경로를 포함한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Cloudflare용 초기 틀을 자체 호스팅 가능한 표준 프로젝트로 정리하고 개발·검증 명령을 고정한다.

- [X] T001 표준 Next.js 실행 스크립트와 Drizzle·Zod·Argon2id·테스트 의존성을 `package.json` 및 `package-lock.json`에 구성하고 vinext/Cloudflare/Sites 전용 의존성과 `vite.config.ts`, `.openai/hosting.json`을 제거한다
- [X] T002 standalone 운영 출력을 사용하도록 `next.config.ts`와 `tsconfig.json`을 정리한다
- [X] T003 [P] 비밀값 파일과 일반 설정을 분리한 환경변수 계약을 `.env.example` 및 `lib/config/env.ts`에 정의한다
- [X] T004 [P] 멀티 스테이지 Node.js 22 운영 이미지를 `Dockerfile` 및 `.dockerignore`에 작성한다
- [X] T005 데이터베이스 health check→migration→app 순서와 선택 가능한 Caddy HTTPS 구성을 `compose.yaml` 및 `Caddyfile`에 작성한다
- [X] T006 Vitest·Testing Library·Playwright와 단위/통합/종단 스크립트를 `vitest.config.ts`, `playwright.config.ts`, `package.json`에 구성한다
- [X] T007 [P] 테스트·운영 데이터와 secret이 추적되지 않도록 `.gitignore`를 보완한다

**Checkpoint**: 의존성 설치, 타입 검사, 빈 Next.js 빌드와 Compose 설정 검증이 가능하다.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리가 공유하는 데이터, 보안, 오류 처리 기반을 만든다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 사용자 스토리 구현을 시작하지 않는다.

- [X] T008 전체 엔티티와 관계·고유 제약·인덱스를 `db/schema.ts`에 정의한다
- [X] T009 초기 스키마 마이그레이션과 행사·질문·관리자 초기화 명령을 `db/migrations/0001_event_core.sql` 및 `db/seed.ts`에 작성한다
- [X] T010 PostgreSQL 연결, health check, 트랜잭션 도우미를 `lib/db/client.ts` 및 `lib/db/transaction.ts`에 구현한다
- [X] T011 [P] `nickname-key-v1` 정규화와 1~24 grapheme 입력 검증을 `lib/validation/nickname.ts`에 구현한다
- [X] T012 [P] 6자리 PIN·8자리 reset code·답변 길이 검증 스키마를 `lib/validation/auth.ts` 및 `lib/validation/answer.ts`에 구현한다
- [X] T013 Argon2id+pepper 검증, 무작위 토큰, digest, constant-time 비교 도우미를 `lib/security/crypto.ts`에 구현한다
- [X] T014 참가자·관리자 세션 발급, 쿠키 속성, idle/absolute 만료와 폐기를 `lib/auth/session.ts` 및 `lib/auth/cookies.ts`에 구현한다
- [X] T015 [P] CSRF 발급·검증과 Origin 검사를 `lib/security/csrf.ts`에 구현한다
- [X] T016 닉네임/IP 범위의 점진적 재시도 제한과 `Retry-After` 계산을 `lib/security/rate-limit.ts`에 구현한다
- [X] T017 참가자·관리자 서버 권한 검사와 보호 라우트 도우미를 `lib/auth/authorization.ts`에 구현한다
- [X] T018 비밀값을 제거한 구조화 오류 응답과 안전한 진단 기록을 `lib/http/errors.ts` 및 `lib/observability/logger.ts`에 구현한다
- [X] T019 [P] 실제 PostgreSQL을 격리해서 초기화·정리하는 통합 테스트 기반을 `tests/helpers/database.ts` 및 `tests/helpers/factories.ts`에 작성한다
- [X] T020 데이터베이스 연결까지 확인하는 상태 응답을 `app/api/health/route.ts`에 구현한다
- [X] T021 마이그레이션 실패 시 앱이 시작되지 않고 재실행해도 초기 데이터가 중복되지 않는 검증을 `tests/integration/bootstrap.test.ts`에 작성한다

**Checkpoint**: 공통 데이터와 인증 경계가 준비되고 `/api/health` 및 실제 DB 기반 테스트가 통과한다.

---

## Phase 3: User Story 1 - 처음 입장하고 내 캐릭터 만나기 (Priority: P1) 🎯 MVP

**Goal**: 초대받은 참가자가 닉네임과 PIN을 등록하고 결정적 픽셀 캐릭터를 받은 뒤 로비에
들어가며, 로그아웃 후 같은 신원으로 재입장한다.

**Independent Test**: 새 데이터베이스에서 참가자가 유효한 초대 코드로 등록해 캐릭터가
있는 로비에 도착하고, 로그아웃한 뒤 같은 닉네임과 PIN으로 재입장해 같은 참가자 ID와
아바타를 확인한다.

### Tests for User Story 1

> **NOTE: 아래 테스트를 먼저 작성하고 실패를 확인한 뒤 구현한다.**

- [X] T022 [P] [US1] Unicode 정규화·중복 key·금지 문자 골든 테스트를 `tests/unit/nickname.test.ts`에 작성한다
- [X] T023 [P] [US1] 아바타 digest와 특성별 파츠가 100회 동일하고 버전별로 재현되는 골든 테스트를 `tests/unit/avatar.test.ts`에 작성한다
- [X] T024 [P] [US1] 등록·로그인·로그아웃·현재 참가자 응답 계약 테스트를 `tests/integration/participant-auth-api.test.ts`에 작성한다
- [X] T025 [P] [US1] 잘못된 초대 코드, 닉네임 충돌, PIN 오류, 점진 제한과 세션 만료 테스트를 `tests/integration/participant-auth-security.test.ts`에 작성한다
- [X] T026 [P] [US1] 360px 화면의 첫 등록→로비→로그아웃→재입장 종단 테스트를 `tests/e2e/participant-onboarding.spec.ts`에 작성한다

### Implementation for User Story 1

- [X] T027 [P] [US1] 안정된 파츠 ID와 `pixel-parts-v1` 카탈로그를 `lib/avatar/catalog.ts` 및 `public/avatar-parts/README.md`에 정의한다
- [X] T028 [US1] 특성별 독립 digest와 버전 입력을 사용하는 결정적 생성기를 `lib/avatar/generator.ts`에 구현한다
- [X] T029 [P] [US1] Event·Participant·AvatarAssignment 저장 및 고유 닉네임 충돌 처리를 `lib/db/repositories/participants.ts`에 구현한다
- [X] T030 [US1] 초대 코드 검증, PIN 등록·로그인, 아바타 최초 배정 트랜잭션을 `lib/auth/participant-service.ts`에 구현한다
- [X] T031 [US1] 등록·로그인·로그아웃·현재 참가자 계약을 `app/api/participants/register/route.ts`, `app/api/participants/login/route.ts`, `app/api/participants/logout/route.ts`, `app/api/me/route.ts`에 구현한다
- [X] T032 [P] [US1] 픽셀 캐릭터를 안정된 파츠 ID로 렌더링하는 접근 가능한 컴포넌트를 `components/avatar/PixelAvatar.tsx`에 구현한다
- [X] T033 [P] [US1] 레트로 RPG 색상·폰트·패널·포커스 토큰을 `app/globals.css` 및 `components/game-ui/GamePanel.tsx`에 구현한다
- [X] T034 [US1] 시작·신규 입장·재입장 폼과 오류 안내를 `app/(public)/page.tsx`, `app/(public)/join/page.tsx`, `app/(public)/login/page.tsx`, `components/forms/ParticipantAuthForm.tsx`에 구현한다
- [X] T035 [US1] 참가자 세션 보호와 닉네임·캐릭터·답변 상태가 보이는 로비를 `app/(participant)/layout.tsx` 및 `app/(participant)/lobby/page.tsx`에 구현한다
- [X] T036 [US1] 등록 중복·잘못된 인증·재시도 제한 메시지와 로딩/재시도 상태를 `components/forms/AuthStatus.tsx`에 연결한다
- [X] T037 [US1] T022~T026을 실행하고 `specs/001-event-core-flow/quickstart.md`의 Scenario 1·2 결과를 기록한다

**Checkpoint**: User Story 1만으로도 초대받은 사람이 고유 캐릭터와 함께 로비에 들어가는 MVP를 시연할 수 있다.

---

## Phase 4: User Story 2 - 3주년 답변을 남기고 다시 고치기 (Priority: P2)

**Goal**: 참가자가 공개된 질문 하나에 답하고, 새로고침·재입장 뒤 최신 성공본을 확인하고
수정하며, 저장 실패 시 작성 중 내용과 마지막 성공본을 잃지 않는다.

**Independent Test**: 미리 생성한 참가자 세션으로 질문 답변을 저장하고 앱을 재시작한 뒤
기존 값을 읽어 수정한다. 다른 참가자 세션에서는 해당 답변을 읽거나 수정할 수 없어야 한다.

### Tests for User Story 2

> **NOTE: 아래 테스트를 먼저 작성하고 실패를 확인한 뒤 구현한다.**

- [X] T038 [P] [US2] 현재 질문·답변 조회·upsert·닫힌 질문 응답 계약 테스트를 `tests/integration/answer-api.test.ts`에 작성한다
- [X] T039 [P] [US2] 답변 소유권, 1~1,000자 검증, 동시 수정과 재시작 지속성 테스트를 `tests/integration/answer-persistence.test.ts`에 작성한다
- [X] T040 [P] [US2] 360px 답변 저장→재입장→수정과 저장 실패 복구 종단 테스트를 `tests/e2e/memory-answer.spec.ts`에 작성한다

### Implementation for User Story 2

- [X] T041 [P] [US2] 공개 질문 조회와 상태 규칙을 `lib/db/repositories/questions.ts` 및 `lib/questions/question-service.ts`에 구현한다
- [X] T042 [P] [US2] 참가자 소유 답변 조회·원자적 upsert를 `lib/db/repositories/answers.ts`에 구현한다
- [X] T043 [US2] 질문 상태, 답변 길이, 소유권을 적용한 답변 서비스를 `lib/answers/answer-service.ts`에 구현한다
- [X] T044 [US2] 현재 질문과 답변 조회·저장 계약을 `app/api/question/current/route.ts` 및 `app/api/answer/current/route.ts`에 구현한다
- [X] T045 [US2] 작성 중 텍스트, 마지막 성공본, 저장 상태를 구분하는 폼을 `components/forms/MemoryAnswerForm.tsx`에 구현한다
- [X] T046 [US2] 질문 준비 상태와 답변 작성·수정 화면을 `app/(participant)/memory/page.tsx`에 구현하고 로비 제출 상태를 `app/(participant)/lobby/page.tsx`에 연결한다
- [X] T047 [US2] T038~T040을 실행하고 `specs/001-event-core-flow/quickstart.md`의 Scenario 3 결과를 기록한다

**Checkpoint**: User Stories 1과 2가 함께 실제 3주년 기록 하나를 끝까지 저장하고 다시 불러온다.

---

## Phase 5: User Story 3 - 진행 상황을 보고 참가자 돕기 (Priority: P3)

**Goal**: 진행자가 별도 인증으로 참가자와 제출 상태를 확인하고, 재인증 후 일회용 코드로
PIN을 초기화해 참가자가 안전하게 새 PIN을 설정하도록 돕는다.

**Independent Test**: 제출 상태가 다른 참가자를 준비하고 관리자 목록과 대조한다. 한
참가자의 PIN을 초기화해 기존 PIN·모든 세션이 즉시 폐기되는지 확인한 뒤, 일회용 코드로
새 PIN을 설정하고 일반 로그인한다.

### Tests for User Story 3

> **NOTE: 아래 테스트를 먼저 작성하고 실패를 확인한 뒤 구현한다.**

- [X] T048 [P] [US3] 관리자 로그인·로그아웃·참가자 목록 권한 계약 테스트를 `tests/integration/admin-api.test.ts`에 작성한다
- [X] T049 [P] [US3] PIN 초기화 재인증·일회용·10분 만료·5회 실패·재발급 계약 테스트를 `tests/integration/pin-reset-api.test.ts`에 작성한다
- [X] T050 [P] [US3] auth_version 증가, 모든 기존 세션 폐기, 감사 기록의 비밀값 제외 테스트를 `tests/integration/pin-reset-security.test.ts`에 작성한다
- [X] T051 [P] [US3] 참가자 관리자 접근 거부와 관리자 목록→PIN 초기화→새 PIN 로그인 종단 테스트를 `tests/e2e/admin-recovery.spec.ts`에 작성한다

### Implementation for User Story 3

- [X] T052 [P] [US3] 관리자 계정·세션·참가자 제출 목록 저장 접근을 `lib/db/repositories/admin.ts`에 구현한다
- [X] T053 [P] [US3] PinResetGrant와 AuditEvent 생성·만료·폐기 저장 접근을 `lib/db/repositories/pin-reset.ts` 및 `lib/db/repositories/audit.ts`에 구현한다
- [X] T054 [US3] 관리자 인증, 짧은 세션, 민감 작업 재인증을 `lib/auth/admin-service.ts`에 구현한다
- [X] T055 [US3] PIN 초기화 트랜잭션과 새 PIN 완료 흐름을 `lib/auth/pin-reset-service.ts`에 구현한다
- [X] T056 [US3] 관리자 로그인·로그아웃·참가자 목록 계약을 `app/api/admin/login/route.ts`, `app/api/admin/logout/route.ts`, `app/api/admin/participants/route.ts`에 구현한다
- [X] T057 [US3] 관리자 PIN 초기화와 참가자 새 PIN 완료 계약을 `app/api/admin/participants/[participantId]/pin-reset/route.ts` 및 `app/api/participants/pin-reset/complete/route.ts`에 구현한다
- [X] T058 [P] [US3] 관리자 로그인과 제출 상태 목록을 `app/admin/login/page.tsx`, `app/admin/page.tsx`, `components/admin/ParticipantList.tsx`에 구현한다
- [X] T059 [US3] 재인증 확인, 일회용 코드 1회 표시, reset code 새 PIN 폼을 `components/admin/PinResetDialog.tsx` 및 `app/(public)/reset-pin/page.tsx`에 구현한다
- [X] T060 [US3] T048~T051을 실행하고 `specs/001-event-core-flow/quickstart.md`의 Scenario 4·5 결과를 기록한다

**Checkpoint**: 진행자가 데이터베이스를 직접 만지지 않고 현장에서 참가자의 입장 문제를 복구할 수 있다.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 세 스토리가 함께 운영될 때의 접근성, 보안, 동시성, 설치·복구 품질을 검증한다.

- [ ] T061 [P] 30명 동시 등록·로그인·답변 저장 부하 시나리오를 `tests/integration/concurrent-event.test.ts`에 작성하고 기록 손실·교차 저장 여부를 검증한다
- [ ] T062 [P] 360px, 키보드 전용, 포커스, 대비, reduced-motion 자동 검사를 `tests/e2e/accessibility.spec.ts`에 추가한다
- [ ] T063 보안 헤더, 민감 응답 `no-store`, 쿠키 속성, CSRF, 로그 비밀값 제외를 `next.config.ts`, `lib/security/headers.ts`, `tests/integration/security-boundaries.test.ts`에서 최종 점검한다
- [ ] T064 [P] 픽셀 파츠·폰트·아이콘의 라이선스와 출처를 `public/avatar-parts/README.md` 및 `THIRD_PARTY_NOTICES.md`에 기록한다
- [ ] T065 백업·복구·업데이트 스크립트를 `scripts/backup.ps1`, `scripts/restore.ps1`, `scripts/deploy.sh`에 작성한다
- [ ] T066 Git clone부터 Compose 실행, 관리자 초기화, 백업과 장애 대응을 `README.md` 및 `docs/DEPLOYMENT.md`에 문서화한다
- [ ] T067 깨끗한 checkout과 빈 volume에서 `specs/001-event-core-flow/quickstart.md` 전체를 실행하고 결과 및 차이를 문서에 반영한다
- [ ] T068 lint, typecheck, unit, integration, e2e, build를 모두 실행하고 발견된 미완료 항목을 `specs/001-event-core-flow/tasks.md`에 추가한다

**Checkpoint**: README만으로 새 서버에 설치할 수 있고, 모든 성공 기준과 헌법 검사를 재현할 수 있다.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: 바로 시작 가능
- **Phase 2 Foundational**: Phase 1 완료 후 시작하며 모든 사용자 스토리를 차단한다
- **Phase 3 US1**: Phase 2 완료 후 시작하는 최소 시연 가능 제품
- **Phase 4 US2**: Phase 2와 등록된 참가자 세션 계약에 의존하므로 US1 다음에 통합한다
- **Phase 5 US3**: Phase 2에 의존하며 seed 참가자를 사용해 US1/US2와 별도로 개발할 수 있지만,
  전체 종단 검증은 US2 이후 수행한다
- **Phase 6 Polish**: 원하는 사용자 스토리 전체가 완료된 뒤 수행한다

### User Story Dependency Graph

```text
Setup → Foundational → US1 참가자 입장 ─→ US2 답변 작성 ─→ Polish
                         └──────────────→ US3 관리자 복구 ─┘
```

- **US1 (P1)**: Foundational 외 다른 스토리 의존 없음
- **US2 (P2)**: 참가자 세션 계약은 US1을 사용하지만 seed 세션으로 독립 테스트 가능
- **US3 (P3)**: 참가자 ID와 답변 상태를 읽지만 factory 데이터로 독립 테스트 가능

### Within Each User Story

- 테스트를 먼저 작성하고 실패를 확인한다.
- 저장 접근과 순수 로직을 먼저 만들고 서비스 트랜잭션을 연결한다.
- 서비스가 통과한 뒤 서버 계약을 구현한다.
- 마지막에 화면을 연결하고 독립 종단 시나리오를 실행한다.

### Parallel Opportunities

- Setup의 T003, T004, T007은 서로 다른 파일에서 병렬 진행 가능
- Foundational의 입력 검증, CSRF, 테스트 기반은 DB 스키마 작업과 병렬 진행 가능
- 각 스토리의 테스트 파일은 서로 독립적으로 먼저 작성 가능
- US1 완료 후 US2와 US3는 factory·계약을 기준으로 병렬 진행 가능
- Phase 6의 동시성·접근성·라이선스 검사는 서로 다른 파일에서 병렬 진행 가능

---

## Parallel Example: User Story 1

```text
Task T022: tests/unit/nickname.test.ts
Task T023: tests/unit/avatar.test.ts
Task T024: tests/integration/participant-auth-api.test.ts
Task T025: tests/integration/participant-auth-security.test.ts
Task T026: tests/e2e/participant-onboarding.spec.ts
```

테스트 실패가 확인된 뒤 T027, T029, T032, T033을 서로 다른 파일에서 병렬 구현할 수 있다.

## Parallel Example: User Story 2

```text
Task T038: tests/integration/answer-api.test.ts
Task T039: tests/integration/answer-persistence.test.ts
Task T040: tests/e2e/memory-answer.spec.ts
```

테스트 실패가 확인된 뒤 T041과 T042를 병렬 구현하고 T043에서 합친다.

## Parallel Example: User Story 3

```text
Task T048: tests/integration/admin-api.test.ts
Task T049: tests/integration/pin-reset-api.test.ts
Task T050: tests/integration/pin-reset-security.test.ts
Task T051: tests/e2e/admin-recovery.spec.ts
```

테스트 실패가 확인된 뒤 T052와 T053을 병렬 구현하고 T054~T057에서 인증 흐름을 연결한다.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup 완료
2. Phase 2 Foundational 완료
3. Phase 3 US1 완료
4. T022~T026과 quickstart Scenario 1·2 검증
5. 실제 휴대폰에서 초대 코드→캐릭터→로비 흐름을 시연하고 멈춰서 피드백 수집

### Incremental Delivery

1. **MVP**: 참가자 등록·재입장과 결정적 캐릭터
2. **기록 가능 버전**: 질문 답변 저장·수정과 로비 제출 상태
3. **행사 운영 버전**: 관리자 목록과 PIN 복구
4. **배포 후보**: 동시성·접근성·보안·백업·새 설치 검증

각 체크포인트에서 이전 스토리의 테스트가 계속 통과해야 다음 단계로 넘어간다.

### Commit Strategy

- Phase 1과 Phase 2는 각각 하나 이상의 독립 커밋으로 남긴다.
- 사용자 스토리는 테스트, 서버 기능, 화면 연결을 논리적 커밋으로 나눈다.
- 마이그레이션과 해당 스키마 코드는 같은 커밋에 둔다.
- 문서와 실행 명령이 달라지면 같은 변경에서 README와 quickstart를 갱신한다.

## Notes

- `[P]`는 파일 충돌 없이 병렬로 진행할 수 있다는 뜻이며 선행 Phase 의존성은 그대로 적용된다.
- `[US1]`, `[US2]`, `[US3]`는 명세의 사용자 스토리와 추적된다.
- 테스트 작업은 대응 구현 전에 실패해야 한다.
- 각 작업 또는 작은 논리 묶음 뒤에 커밋한다.
- 범위 밖 기능을 발견하면 이 목록에 섞지 않고 새 기능 명세 후보로 기록한다.
