---

description: "대화 아바타 작업을 현재 서비스에 통합하고 배포 준비 문제를 해결하는 실행 작업 목록"
---

# Tasks: 대화 아바타 배포 준비

**Input**: Design documents from `/specs/004-conversation-avatar-readiness/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 명세 FR-014와 성공 조건에서 자동 검증을 요구하므로 각 사용자 스토리의 실패 테스트를 구현보다 먼저 작성한다.

**Organization**: 작업은 사용자 스토리별로 묶되, 현재 더러운 작업 트리를 보존하고 메인 기준선 위로 안전하게 재배치하는 단계가 모든 스토리를 먼저 막는다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 선행 작업이 끝난 뒤 다른 파일에서 병렬로 진행할 수 있음
- **[Story]**: spec.md의 사용자 스토리 번호
- 모든 작업은 수정하거나 생성할 정확한 경로를 포함함

## Phase 1: Setup (변경본 보존과 범위 고정)

**Purpose**: 로컬에만 있는 `003` 구현과 `004` 설계 산출물을 잃지 않고 재배치할 수 있는 복구 기준점을 만든다.

- [X] T001 수정·미추적·무시 파일을 `003` 구현, `004` 문서, 로컬 전용 자료로 분류하고 필수 전달 파일 목록과 현재 `codex/conversation-avatar` SHA를 `specs/004-conversation-avatar-readiness/integration-inventory.md`에 기록한다.
- [X] T002 [P] PIN·초대 코드·세션·실제 닉네임·카카오 user ID·대화 원문·분석 JSON·DB dump가 변경본에 없는지 검사하고 파일명과 검사 결과만 `specs/004-conversation-avatar-readiness/privacy-scan.md`에 기록한다.
- [X] T003 [P] `specs/003-conversation-avatar/tasks.md`의 미완료 항목과 `specs/004-conversation-avatar-readiness/checklists/requirements.md`를 대조해 이번 구간으로 이관된 항목과 `003`에 남는 항목을 체크리스트 Notes에 기록한다.
- [X] T004 T001~T003 결과를 확인한 뒤 대화 아바타 코드·테스트·명세·계획 전체를 저장소 루트 `.`에서 복구 가능한 로컬 커밋으로 고정하고 해당 commit에 `conversation-avatar-pre-rebase` 복구 태그를 만든다.

**Checkpoint**: 미추적 필수 파일이 사라질 위험 없이 언제든 현재 대화 아바타 상태로 돌아갈 수 있다.

---

## Phase 2: Foundational (메인 기준선 통합)

**Purpose**: 모든 사용자 스토리가 현재 진행자 기능과 함께 개발·검증되는 단일 기준선을 만든다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 인증, 제한, 접근성 구현을 시작하지 않는다.

- [X] T005 `codex/mvp-core-flow`와 `origin/codex/mvp-core-flow`를 갱신·비교해 통합 기준 SHA와 `conversation-avatar-pre-rebase` 복구 SHA를 `specs/004-conversation-avatar-readiness/integration-inventory.md`에 기록하고 이 inventory 갱신을 커밋해 깨끗한 재배치 입력을 만든다.
- [X] T006 복구 SHA를 유지한 채 `codex/conversation-avatar`를 T005의 기준 SHA 위로 재배치하고 충돌 파일 목록을 `specs/004-conversation-avatar-readiness/integration-inventory.md`에 기록한다.
- [X] T007 `db/schema.ts`, `app/admin/page.tsx`, `README.md`, `docs/DEPLOYMENT.md` 충돌을 해결해 진행자 엔티티·화면·운영 절차와 대화 프로필 엔티티·현황 화면을 모두 보존한다.
- [X] T008 [P] `package.json`, `package-lock.json`, `THIRD_PARTY_NOTICES.md`, `public/avatar-parts/README.md`를 현재 기준선과 대화 아바타 의존성·라이선스가 함께 맞도록 정리한다.
- [X] T009 [P] `db/schema.ts`의 최종 모델에 진행자 테이블, 대화 프로필 테이블, conversation 아바타 연결과 `participant_register` 제한 action이 모두 포함되고 이벤트·배치·별칭 관계가 일치하도록 통합한다.
- [ ] T010 재배치 뒤 `npm ci`, lint, typecheck, build, 단위 테스트와 Python 분석 테스트를 실행하고 결과 및 남은 충돌 0건을 `specs/004-conversation-avatar-readiness/integration-inventory.md`에 기록한다.

**Checkpoint**: `codex/conversation-avatar`가 현재 메인 기준선을 포함하고, 양쪽 기능의 소스가 한 작업 트리에서 빌드된다.

---

## Phase 3: User Story 1 - 현재 서비스에 빠짐없이 합치기 (Priority: P1) 🎯 MVP

**Goal**: 기존 질문·답변·진행자 기능을 보존하면서 `0003` 대화 프로필 변경을 새 설치와 기존 설치에 재현 가능하게 적용한다.

**Independent Test**: 빈 DB와 `0002_presenter_results`까지 적용된 DB에 후보 변경을 각각 적용하고, 기존 진행 상태와 대화 아바타 흐름이 함께 동작하는지 확인한다.

### Tests for User Story 1 ⚠️

> **NOTE: 아래 테스트를 먼저 작성하고 현재 충돌 마이그레이션에서 실패하는지 확인한다.**

- [ ] T011 [P] [US1] 깨끗한 DB의 `0001 → 0002 → 0003`, 마이그레이션 재실행, journal 순서와 양쪽 테이블 존재를 검증하는 실패 테스트를 `tests/integration/bootstrap.test.ts`에 작성한다.
- [ ] T012 [P] [US1] `0002` 상태의 참가자·답변·발표 session/item을 만든 뒤 `0003` 적용 후 개수·revision·작성자 공개 상태 보존을 검증하는 업그레이드 테스트를 `tests/integration/presentation-concurrency.test.ts`에 작성한다.
- [ ] T013 [P] [US1] 대화 아바타 참가자의 답변을 선택하고 작성자를 공개했을 때 확정 traits가 진행자와 프로젝터 snapshot에 그대로 나타나는 회귀 테스트를 `tests/integration/presentation-api.test.ts`와 `tests/e2e/presenter-results.spec.ts`에 작성한다.

### Implementation for User Story 1

- [ ] T014 [US1] 충돌한 `db/migrations/0002_conversation_profiles.sql`을 제거하고 최종 `db/schema.ts` 기준의 `db/migrations/0003_conversation_profiles.sql`을 생성해 대화 프로필 구조와 `participant_register` enum 확장만 전진 적용한다.
- [ ] T015 [US1] `db/migrations/meta/_journal.json`을 `0001_event_core`, `0002_presenter_results`, `0003_conversation_profiles` 순서와 고유 인덱스로 정리하고 기존 `db/migrations/0001_event_core.sql`, `db/migrations/0002_presenter_results.sql`은 변경하지 않는다.
- [ ] T016 [US1] 진행자·대화 프로필 테이블을 함께 초기화하고 운영 DB 오입력을 거절하도록 `tests/helpers/database.ts`와 `tests/integration/bootstrap.test.ts`의 테스트 DB 가드를 정리한다.
- [ ] T017 [P] [US1] 관리자 홈에서 기존 참가자·PIN 복구·진행자 링크와 활성 대화 프로필 준비 현황을 모두 유지하도록 `app/admin/page.tsx`와 `components/admin/AvatarProfileStatus.tsx`를 통합한다.
- [ ] T018 [P] [US1] `compose.yaml`, `scripts/deploy.sh`, `scripts/backup.ps1`, `scripts/restore.ps1`에서 새 설치와 `0002` 기존 DB 갱신이 같은 migration runner를 사용하고 실패 전 백업을 요구하도록 정리한다.
- [ ] T019 [US1] T011~T013과 기존 진행자·질문·답변 회귀 테스트를 실행해 마이그레이션 재실행과 데이터 보존을 확인하고 `specs/004-conversation-avatar-readiness/integration-inventory.md`를 갱신한 뒤 US1 구현 전체를 커밋해 검증할 candidate SHA를 고정한다.
- [ ] T020 [US1] T019의 candidate commit을 임시 디렉터리에 `--no-local`로 clone해 필수 추적 파일, 빈 DB 설치, `0002` DB 1회 갱신을 각각 스모크 검증하고 시작·종료 시각과 결과를 `specs/004-conversation-avatar-readiness/validation/us1-smoke.md`에 남긴다.

**Checkpoint**: 다른 작업자가 같은 commit으로 기존 기능과 대화 아바타 기능을 함께 설치할 수 있다.

---

## Phase 4: User Story 2 - 어떤 승인 닉네임으로도 계정 복구하기 (Priority: P1)

**Goal**: 정식 닉네임과 승인 별칭이 가입·로그인·PIN 초기화에서 같은 참가자 계정으로 해석되고 기존 답변·아바타를 유지한다.

**Independent Test**: 승인 별칭으로 가입한 계정의 PIN을 초기화한 뒤 같은 별칭과 새 PIN으로 로그인하고 participant, answer, current avatar ID가 그대로인지 확인한다.

### Tests for User Story 2 ⚠️

- [ ] T021 [P] [US2] 정식 닉네임·승인 별칭의 단일 해석, 직접 닉네임과 별칭의 교차 계정 충돌, 비활성 배치 제외를 검증하는 실패 테스트를 `tests/integration/conversation-profile-repository.test.ts`에 작성한다.
- [ ] T022 [P] [US2] 승인 별칭 PIN 초기화 성공과 participant·answer·current avatar 보존, 미등록·충돌 이름 각 20회의 동일한 외부 오류와 계정 변경 0건을 검증하는 실패 테스트를 `tests/integration/pin-reset-api.test.ts`와 `tests/integration/pin-reset-security.test.ts`에 작성한다.
- [ ] T023 [P] [US2] 승인 별칭 가입 → 관리자 초기화 코드 발급 → 같은 별칭으로 PIN 변경 → 재로그인 → 기존 답변·아바타 확인 흐름을 `tests/e2e/admin-recovery.spec.ts`에 작성한다.

### Implementation for User Story 2

- [ ] T024 [US2] 활성 batch·event·profile 일치를 확인하고 `resolved | not_found | ambiguous`를 반환하는 공통 이름 해석 함수를 `lib/db/repositories/conversation-profiles.ts`에 구현한다.
- [ ] T025 [P] [US2] 가입과 로그인이 T024의 이름 해석·활성 프로필 규칙을 공유하고 충돌 시 자동 계정 선택을 하지 않도록 `lib/auth/participant-service.ts`를 수정한다.
- [ ] T026 [P] [US2] PIN 초기화 완료가 T024로 참가자 ID를 해석하고 정식 닉네임·별칭 모두에서 같은 grant와 계정을 사용하도록 `lib/auth/pin-reset-service.ts`를 수정한다.
- [ ] T027 [US2] 미등록·충돌·잘못된 PIN 및 reset code가 계정 존재를 드러내지 않는 계약을 유지하도록 `app/api/participants/login/route.ts`, `app/api/participants/pin-reset/complete/route.ts`, `lib/validation/auth.ts`를 `specs/004-conversation-avatar-readiness/contracts/openapi.yaml`과 맞춘다.
- [ ] T028 [US2] T021~T023과 기존 로그인·PIN 초기화 회귀 테스트를 실행하고 같은 participant·answer·avatar 식별자 보존 결과를 `specs/004-conversation-avatar-readiness/validation/us2-alias-recovery.md`에 기록한다.

**Checkpoint**: 참가자는 가입에 사용한 어떤 승인 이름으로도 기존 계정을 안전하게 복구할 수 있다.

---

## Phase 5: User Story 3 - 반복 가입 요청에도 행사 서비스 유지하기 (Priority: P2)

**Goal**: 미승인 이름은 비싼 PIN 해시 전에 거절하고, 승인 이름의 반복 요청은 행사·이름·출처 범위에서 원자적으로 제한한다.

**Independent Test**: 한 출처와 닉네임의 반복 가입을 제한하면서 다른 닉네임 참가자 20명이 전원 2초 안에 가입하는지 확인한다.

### Tests for User Story 3 ⚠️

- [ ] T029 [P] [US3] 같은 subject의 미승인 닉네임 실패 누적, 승인 닉네임 병렬 시도 슬롯 소비, 차단 만료, 성공 시 clear와 다른 subject 격리를 검증하는 실패 테스트를 `tests/integration/participant-registration-throttle.test.ts`에 작성한다.
- [ ] T030 [P] [US3] 미승인 닉네임에서 Argon2 호출 0회, 제한된 승인 닉네임에서 추가 해시 0회, 동시 선점 한 건만 성공을 검증하는 실패 테스트를 `tests/integration/participant-auth-security.test.ts`에 작성한다.
- [ ] T031 [P] [US3] 같은 미승인 닉네임 반복이 한도 뒤 429가 되는지, 가입 429 응답의 `Retry-After`, `retryAfterSeconds`, 사용자 안내와 다른 닉네임 20명의 성공을 검증하는 계약 테스트를 `tests/integration/conversation-avatar-register-api.test.ts`에 작성한다.

### Implementation for User Story 3

- [ ] T032 [US3] `participant_register` subject의 시도 슬롯을 잠금 또는 동등한 원자 연산으로 소비하고 차단 상태를 반환하는 함수를 `lib/security/rate-limit.ts`에 구현한다.
- [ ] T033 [US3] 초대·활성 배치 뒤 subject 차단 상태를 먼저 확인하고, 미승인 닉네임은 PIN 해시 없이 실패 횟수만 기록하며, 승인·미선점 프로필은 T032 슬롯을 소비한 요청만 해시를 실행하고 성공 subject만 clear하도록 `lib/auth/participant-service.ts`의 가입 순서를 바꾼다.
- [ ] T034 [US3] 제한 응답에서 body와 `Retry-After` 헤더가 같은 남은 시간을 사용하도록 `lib/http/errors.ts`와 `app/api/participants/register/route.ts`를 정리한다.
- [ ] T035 [P] [US3] 가입 제한 로그와 테스트 산출물에 IP 원문·닉네임·PIN·초대 코드가 남지 않도록 `lib/observability/logger.ts`와 `tests/integration/conversation-avatar-privacy.test.ts`를 보강한다.
- [ ] T036 [P] [US3] 정상 가입 p95 2초와 제한 subject·다른 정상 참가자 20명의 격리를 재현하는 측정 절차를 `scripts/benchmark-conversation-avatars.md`에 추가한다.
- [ ] T037 [US3] T029~T031과 측정 절차를 실행해 Argon2 호출 수, 제한 범위와 정상 참가자 성공률을 `specs/004-conversation-avatar-readiness/validation/us3-registration-throttle.md`에 기록한다.

**Checkpoint**: 공통 초대 코드를 아는 반복 요청이 정상 참가자의 가입 자원을 고갈시키지 않는다.

---

## Phase 6: User Story 4 - 보조기술에서도 편안하게 캐릭터 확인하기 (Priority: P2)

**Goal**: 시각적 후보 연출은 유지하면서 보조기술에는 준비·완료만 안내하고, 움직임 축소 환경에서는 1초 안에 확정 결과를 제공한다.

**Independent Test**: 움직임 축소, 스크린리더 접근성 트리와 키보드만 사용해 가입부터 확정 카드 상호작용까지 완료한다.

### Tests for User Story 4 ⚠️

- [ ] T038 [P] [US4] 후보 컨테이너가 접근성 트리에서 제외되고 status가 준비·완료만 한 번씩 갱신되며 reduced motion에서 interval이 생기지 않는 실패 테스트를 `tests/unit/avatar-reveal.test.tsx`에 작성한다.
- [ ] T039 [P] [US4] 360px·고대비·키보드에서 후보 낭독 0회와 임시 카드 tab 제외를 검증하고, reduced motion 공개 20회가 모두 1초 안에 확정되며 공개 중 새로고침·재접속 20회에도 계정·확정 아바타가 각각 하나인지 확인하는 시나리오를 `tests/e2e/avatar-reveal.spec.ts`와 `tests/e2e/accessibility.spec.ts`에 작성한다.

### Implementation for User Story 4

- [ ] T040 [US4] 시각 셔플 컨테이너와 별도 `role=status` 안내를 분리하고 motion 확인 전 정적 상태를 두도록 `components/avatar/AvatarReveal.tsx`를 수정한다.
- [ ] T041 [US4] 셔플 중 임시 개발자 카드는 상호작용과 tab 순서에서 제외하고 확정 뒤에만 상태 변경 버튼을 활성화하도록 `components/avatar/DeveloperIdentityCard.tsx`를 수정한다.
- [ ] T042 [P] [US4] `checking-motion`, `shuffling`, `ready`, 고대비와 reduced-motion 표현이 360px에서도 겹치지 않도록 `app/globals.css`를 정리한다.
- [ ] T043 [US4] T038~T039를 실행하고 20회 반복과 중복 0건을 포함한 자동 접근성 결과를 `specs/004-conversation-avatar-readiness/validation/us4-accessibility.md`에 기록한다.

**Checkpoint**: 빠른 후보 연출을 보거나 듣기 어려운 참가자도 같은 확정 프로필을 무리 없이 확인한다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 모든 사용자 스토리를 실제 배포 후보 한 개로 묶고 새 설치·업그레이드·수동 접근성을 최종 확인한다.

- [ ] T044 [P] 새 설치, 기존 `0002` 서버 갱신, migration 실패 후 복구, 대화 프로필 import와 검증용 Compose project 정리 절차를 `README.md`, `docs/DEPLOYMENT.md`, `specs/004-conversation-avatar-readiness/quickstart.md`에 서로 일치하게 반영한다.
- [ ] T045 [P] `specs/004-conversation-avatar-readiness/contracts/deployment-validation.schema.json`을 검증하는 `scripts/validate-deployment-record.ts`와 실행 명령을 `package.json`에 추가하고 민감정보가 든 record 거절 테스트를 `tests/unit/deployment-validation.test.ts`에 작성한다.
- [ ] T046 T044~T045와 모든 제품 코드·마이그레이션을 커밋해 candidate SHA를 고정한 뒤 새 clone과 격리된 `avatar-clean-1`~`avatar-clean-3` project에서 빈 volume 설치·migration 재실행·대표 UI를 각각 30분 안에 세 번 검증하고 계약에 맞는 `specs/004-conversation-avatar-readiness/validation/clean-install-{1,2,3}.json`을 남긴다.
- [ ] T047 `0002_presenter_results`까지 적용된 격리 DB 세 개에서 backup 검사 후 `0003` 갱신, 참가자·답변·진행 상태 보존과 migration 재실행을 검증하고 `specs/004-conversation-avatar-readiness/validation/existing-upgrade-{1,2,3}.json`을 남긴다.
- [ ] T048 lint, typecheck, build, unit, Python 분석, PostgreSQL integration, Playwright E2E, `git diff --check`를 모두 실행하고 결과를 `specs/004-conversation-avatar-readiness/validation/final-gates.md`에 기록한다.
- [ ] T049 NVDA 또는 행사에서 사용할 실제 스크린리더로 공개 연출을 한 번 확인하고 후보 반복 낭독 0회·준비/완료 각 1회 이하 결과만 `specs/004-conversation-avatar-readiness/validation/manual-accessibility.md`에 기록한다.
- [ ] T050 `specs/003-conversation-avatar/tasks.md`, `specs/004-conversation-avatar-readiness/tasks.md`, `specs/004-conversation-avatar-readiness/checklists/requirements.md`의 완료 상태와 검증 기록을 최종 커밋하고, T046 candidate 이후 제품 코드·마이그레이션 변경 0건과 최종 SHA의 정적·단위 게이트를 다시 확인한 뒤 `codex/conversation-avatar` upstream을 같은 SHA로 갱신한다.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: 즉시 시작 가능하다. T001~T003을 끝낸 뒤 T004 복구 커밋을 만든다.
- **Phase 2 — Foundational**: Phase 1의 복구 커밋에 의존하며 모든 사용자 스토리를 막는다.
- **Phase 3 — US1**: Phase 2 뒤 시작한다. 최종 migration 계보와 현재 서비스 통합을 제공한다.
- **Phase 4 — US2**: Phase 2 뒤 시작할 수 있지만 최종 배포 검증은 US1의 `0003` DB 구조를 사용한다.
- **Phase 5 — US3**: Phase 2의 `participant_register` schema에 의존하며 US2와 병렬 진행 가능하다.
- **Phase 6 — US4**: Phase 2 뒤 독립적으로 시작할 수 있고 US1~US3과 UI 파일이 겹치지 않아 병렬 진행 가능하다.
- **Phase 7 — Polish**: 배포하려는 모든 사용자 스토리와 그 자동 테스트가 완료된 뒤 시작한다.

### User Story Dependencies

```text
Setup → Foundational → US1 ───────────────┐
                       ├→ US2 ────────────┤
                       ├→ US3 ────────────┼→ Polish → release-ready
                       └→ US4 ────────────┘
```

- **US1 (P1)**: 현재 메인 기준선과 migration을 통합하는 최소 안전 MVP다.
- **US2 (P1)**: 공통 이름 해석을 사용하며 US1과 같은 최종 DB 위에서 검증한다.
- **US3 (P2)**: Phase 2의 제한 action만 필요하며 US2와 병렬 구현 가능하다.
- **US4 (P2)**: 클라이언트 일시 상태만 바꾸므로 Phase 2 이후 다른 스토리와 독립 구현 가능하다.

### Within Each User Story

- 실패 테스트 작성 및 실패 확인 → 저장소/상태 모델 → 서비스 → API·UI → 통합 검증 순서다.
- 같은 파일을 수정하는 작업은 병렬 표시하지 않았다.
- 각 Checkpoint에서 해당 스토리 테스트를 통과하기 전 다음 우선순위로 넘어가지 않는다.
- migration·운영 검증은 운영 DB가 아닌 삭제 가능한 전용 DB와 고유 Compose project만 사용한다.

### Parallel Opportunities

- T002와 T003은 T001과 다른 문서를 다뤄 병렬 실행할 수 있다.
- 재배치 뒤 T008 의존성 정리와 T009 최종 schema 통합은 서로 다른 파일에서 병렬 실행할 수 있다.
- US1의 T011~T013 실패 테스트는 서로 다른 통합·E2E 파일에서 병렬 작성할 수 있다.
- US2의 T021~T023 테스트, T025와 T026 서비스 수정은 각각 병렬 진행할 수 있다.
- US3의 T029~T031 테스트와 T035~T036 보안·측정 작업은 각각 병렬 진행할 수 있다.
- US4의 T038~T039 테스트와 T042 CSS 작업은 다른 파일에서 병렬 진행할 수 있다.
- Phase 2 완료 뒤 US2, US3, US4는 담당 파일 충돌을 조정하면 동시에 진행할 수 있다.

---

## Parallel Example: User Story 1

```text
Task T011: "tests/integration/bootstrap.test.ts에 clean migration 실패 테스트 작성"
Task T012: "tests/integration/presentation-concurrency.test.ts에 기존 DB upgrade 실패 테스트 작성"
Task T013: "tests/integration/presentation-api.test.ts와 tests/e2e/presenter-results.spec.ts에 traits 회귀 테스트 작성"
```

## Parallel Example: User Stories 2–4

```text
Agent A: T021 → T024 → T025/T026 → T027 → T028
Agent B: T029/T030/T031 → T032 → T033 → T034 → T037
Agent C: T038/T039 → T040 → T041/T042 → T043
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1에서 현재 변경을 복구 가능한 commit으로 고정한다.
2. Phase 2에서 현재 메인 기준선 위로 재배치하고 양쪽 기능을 보존한다.
3. Phase 3에서 `0003` 계보와 clean/upgrade 스모크 테스트를 완성한다.
4. **STOP AND VALIDATE**: 다른 clone에서 기존 기능과 대화 아바타가 함께 설치되는지 확인한다.

US1만으로 변경본 손실과 migration 충돌은 해결되지만 참가자 대상 배포 후보는 아니다. 별칭 PIN 복구가 행사 중 복구 수단이므로 최소 운영 가능 범위는 US1과 US2까지다.

### Incremental Delivery

1. Setup + Foundational → 변경본 보존과 기준선 통합
2. US1 → 재현 가능한 migration과 기존 기능 보존
3. US2 → 승인 별칭 계정 복구 일관성
4. US3 → 반복 가입 요청의 자원 보호
5. US4 → 공개 연출 접근성
6. Polish → 새 설치·기존 DB 갱신 각 3회와 최종 배포 게이트

### Parallel Team Strategy

1. 한 명이 Setup과 Foundational을 끝내 단일 통합 기준점을 만든다.
2. 기준점 이후 인증 복구(US2), 가입 제한(US3), 공개 접근성(US4)을 서로 다른 담당자가 병렬 진행한다.
3. migration 소유자는 US1과 최종 schema를 관리하고 다른 스토리는 migration 파일을 직접 다시 생성하지 않는다.
4. 마지막 담당자가 Phase 7 검증 기록을 모아 하나의 후보 SHA를 판정한다.

---

## Notes

- `[P]` 작업은 선행 작업 완료 뒤 다른 경로에서 실행할 수 있다.
- 제품 코드 수정 전에 해당 스토리의 실패 테스트를 먼저 작성한다.
- 모든 기록에는 실제 비밀값, IP, 닉네임, 답변·대화 원문을 넣지 않는다.
- 운영 DB와 운영 Compose project에는 테스트 정리 명령이나 volume 삭제를 실행하지 않는다.
- 각 작업 또는 작은 논리 묶음 뒤에 복구 가능한 commit을 남긴다.
