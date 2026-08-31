# Tasks: 질문별 답변 공개 진행

**Input**: Design documents from `/specs/003-question-answer-sequence/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml),
[quickstart.md](./quickstart.md)

**Tests**: 행사 진행 상태와 접근 경계는 새로고침·동시 요청에서 깨지기 쉬우므로, 각 스토리의
단위·통합·브라우저 검증을 구현 전에 작성한다.

**Organization**: 작업은 사용자 스토리별로 묶는다. 한 질문 안에서 답변을 공개하고 작성자를
공개하는 P1이 가장 작은 행사 진행 MVP이며, 이후 질문 전환과 전체 마무리를 추가한다.

## Format: `[ID] [P?] [Story] Description`

- `[P]`는 해당 단계의 선행 작업이 끝난 뒤 다른 파일에서 병렬로 진행할 수 있는 작업이다.
- `[US1]`, `[US2]`, `[US3]`는 `spec.md`의 사용자 스토리 추적 라벨이다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 네 질문을 갖는 행사 fixture와 문서 기준을 테스트 환경에 준비한다.

- [ ] T001 [P] 네 개 고정 질문과 질문별 답변 fixture를 `tests/helpers/factories.ts`에 추가한다
- [X] T002 [P] 발표·질문 진행 상태를 테스트마다 정리하도록 `tests/helpers/database.ts`를 갱신한다
- [ ] T003 [P] 행사 전 네 답변 작성, 행사 중 공개, 완료 뒤 기록 열람의 운영 흐름을 `README.md`에 기록한다

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 질문 순서, 행사 진행 포인터, 답변 완료 상태와 입력 계약을 만든다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 사용자 스토리 구현을 시작하지 않는다.

- [X] T004 질문 순서와 답변 완료 상태 enum·행사 진행 상태 테이블을 `db/schema.ts`에 정의한다
- [X] T005 T004의 스키마 변경, 기존 질문의 순서 backfill, 네 답변 가능 질문 허용과 새 인덱스를 `db/migrations/0004_question_answer_sequence.sql` 및 `db/migrations/meta/_journal.json`에 추가한다
- [X] T006 네 질문을 멱등적으로 만들고 행사 전부터 모두 답변 가능하도록 `db/seed.ts` 및 `db/seed-demo.ts`를 수정한다
- [ ] T007 [P] `start_question`, `reveal_next_answer`, `reveal_author`, `exclude_current_answer`, `advance_question`, `review_question` allowlist를 `lib/validation/presentation.ts`에 정의한다
- [ ] T008 질문 순서 조회·질문 상태 전환·행사 진행 행 잠금 연산을 `lib/db/repositories/questions.ts` 및 `lib/db/repositories/presentation.ts`에 구현한다
- [ ] T009 답변 완료·제외 상태, 현재 질문과 네 질문 진행 현황을 표현하는 DTO 타입을 `lib/presentation/presentation-view.ts`에 정의한다
- [ ] T010 행사 전 네 답변 가능 질문을 참가자에게 반환하도록 `lib/questions/question-service.ts`, `app/api/questions/route.ts`, `components/forms/MemoryAnswerForm.tsx`를 확장한다

**Checkpoint**: 빈 DB와 기존 단일 질문 DB를 마이그레이션한 뒤, 행사는 순서가 있는 질문 네 개와
영속 진행 상태 한 개를 가진다.

---

## Phase 3: User Story 1 - 첫 질문부터 답변을 순서대로 공유하기 (Priority: P1) 🎯 MVP

**Goal**: 진행자가 첫 질문을 시작하고, 답변 하나를 익명으로 공개한 다음 작성자를 공개한다.

**Independent Test**: 첫 질문에 답변 세 개를 둔 행사에서 진행자가 첫 질문을 열고 한 답변을
보여 준 뒤 작성자를 공개한다. 프로젝터 응답은 작성자 공개 전 `author` 필드를 포함하지 않는다.

### Tests for User Story 1

- [ ] T011 [P] [US1] 답변 공개·작성자 공개 상태 전이와 작성자 공개 전 다음 답변 차단 단위 테스트를 `tests/unit/presentation-state.test.ts`에 작성한다
- [ ] T012 [P] [US1] 관리자 권한·Origin·CSRF, 익명 DTO redaction과 첫 질문 command 계약 통합 테스트를 `tests/integration/presentation-api.test.ts`에 작성한다
- [ ] T013 [P] [US1] 진행자와 프로젝터 두 페이지에서 질문 시작→익명 답변→작성자 공개를 검증하는 테스트를 `tests/e2e/presenter-results.spec.ts`에 작성한다

### Implementation for User Story 1

- [ ] T014 [US1] 행사 진행 행과 현재 질문 발표 세션을 잠가 다음 미완료 답변의 스냅샷을 만드는 연산을 `lib/db/repositories/presentation.ts`에 구현한다
- [ ] T015 [US1] 질문 시작·다음 답변 공개·작성자 공개·현재 답변 제외 명령과 전환 오류를 `lib/presentation/presentation-service.ts`에 구현한다
- [ ] T016 [US1] 새 명령의 관리자·CSRF 검증과 `no-store, private` 응답을 `app/api/admin/presentation/commands/route.ts`에 연결한다
- [ ] T017 [US1] 현재 질문, 현재 답변과 작성자 공개 여부만 화면별 allowlist DTO로 조립하도록 `lib/presentation/presentation-view.ts`를 구현한다
- [ ] T018 [P] [US1] 질문 시작·답변 공개·작성자 공개·제외 확인을 제공하는 조작 UI를 `components/admin/presenter/PresenterController.tsx`에 구현한다
- [ ] T019 [P] [US1] 현재 질문의 답변 목록과 답변별 공개·완료·제외 상태를 `components/admin/presenter/AnswerQueue.tsx`에 구현한다
- [ ] T020 [US1] 진행자·프로젝터 GET 응답이 새 DTO와 질문 시작 대기 상태를 반환하도록 `app/api/admin/presentation/route.ts`, `app/api/admin/presentation/screen/route.ts` 및 `components/admin/presenter/PresentationScreen.tsx`를 수정한다
- [ ] T021 [US1] T011~T013을 실행하고 첫 질문의 독립 검증 결과를 `specs/003-question-answer-sequence/quickstart.md`에 기록한다

**Checkpoint**: 한 질문의 답변은 항상 `답변 공개 → 작성자 공개` 순서로 진행하며, 작성자를
공개하기 전에는 다음 답변으로 넘어가지 않는다.

---

## Phase 4: User Story 2 - 질문 하나를 끝낸 뒤 다음 질문으로 넘어가기 (Priority: P2)

**Goal**: 현재 질문의 모든 답변을 마친 경우에만 다음 순서 질문을 열고, 아직 열지 않은 질문은
참석자 화면에서 숨긴다.

**Independent Test**: 첫 질문의 답변을 모두 완료하기 전에는 2번 질문 전환이 거부되고, 완료한
뒤에는 2번 질문이 시작되어 프로젝터가 이전 질문 대신 2번 질문만 본다.

### Tests for User Story 2

- [ ] T022 [P] [US2] 남은 답변·제외 답변·빈 질문의 완료 판정과 1→2→3→4 전환 게이트 단위 테스트를 `tests/unit/presentation-state.test.ts`에 추가한다
- [ ] T023 [P] [US2] 두 관리자 창의 동시 다음 답변·다음 질문 요청이 질문 건너뛰기 없이 직렬 처리되는 테스트를 `tests/integration/presentation-concurrency.test.ts`에 작성한다
- [ ] T024 [P] [US2] 미완료 전환 409, 아직 열지 않은 질문 비노출, 질문 상태 변경과 새로고침 복구 통합 테스트를 `tests/integration/presentation-api.test.ts`에 추가한다
- [ ] T025 [US2] 첫 질문 완료→두 번째 질문 시작→미완료 전환 차단의 브라우저 흐름을 `tests/e2e/presenter-results.spec.ts`에 추가한다

### Implementation for User Story 2

- [ ] T026 [US2] 질문별 완료 수·남은 수 계산, 현재 질문의 완료 확인과 다음 질문 원자 전환을 `lib/db/repositories/presentation.ts` 및 `lib/db/repositories/questions.ts`에 구현한다
- [ ] T027 [US2] `advance_question`과 완료 질문 `review_question` 명령, 빈 질문 처리와 revision 증가를 `lib/presentation/presentation-service.ts`에 구현한다
- [ ] T028 [US2] 질문별 locked/current/completed 현황과 전환 가능 여부를 `lib/presentation/presentation-view.ts` 및 `app/api/admin/presentation/route.ts`에 노출한다
- [ ] T029 [US2] 질문별 남은 답변 수, 다음 질문 시작 버튼, 미완료 안내와 완료 질문 재확인을 `components/admin/presenter/PresenterController.tsx` 및 `components/admin/presenter/PresenterSummary.tsx`에 구현한다
- [ ] T030 [US2] 행사 시작 뒤에는 답변 작성·수정을 막고, 아직 완료되지 않은 참가자는 자신의 저장 상태만 확인하도록 `components/forms/MemoryAnswerForm.tsx`, `lib/answers/answer-service.ts` 및 `app/api/answer/current/route.ts`를 조정한다
- [ ] T031 [US2] T022~T025과 기존 참가자 답변 회귀 테스트를 실행하고 두 번째 질문까지의 결과를 `specs/003-question-answer-sequence/quickstart.md`에 기록한다

**Checkpoint**: 질문은 정해진 순서로만 열리며, 현재 질문에 미완료 답변이 하나라도 있으면
다음 질문으로 넘어갈 수 없다.

---

## Phase 5: User Story 3 - 마지막까지 마치고 질답 시간을 닫기 (Priority: P3)

**Goal**: 네 번째 질문의 답변까지 모두 마친 뒤 전체 완료 상태를 보여 주고, 로그인한 참가자가
모든 질문·답변·작성자를 다시 볼 수 있게 한다.

**Independent Test**: 네 번째 질문의 마지막 답변을 작성자 공개까지 마치면 진행자와 프로젝터가
전체 완료 상태를 보이고, 로그인한 참가자는 질문별 모든 답변과 작성자를 열람할 수 있다.

### Tests for User Story 3

- [ ] T032 [P] [US3] 마지막 질문 완료, 빈 질문, 프로젝터 completed DTO와 완료 후 질답 기록 DTO 단위 테스트를 `tests/unit/presentation-view.test.ts` 및 `tests/unit/presentation-state.test.ts`에 작성한다
- [ ] T033 [P] [US3] 서비스 재시작·새로고침 복구, 완료 전 참가자 비노출, 완료 후 로그인 참가자 열람과 원본 Answer 불변 통합 테스트를 `tests/integration/presentation-api.test.ts` 및 `tests/integration/security-boundaries.test.ts`에 추가한다
- [ ] T034 [US3] 4번 질문과 빈 질문의 마무리, 완료 후 질답 기록 열람, 1,000자 답변·키보드·연결 복구를 검증하는 브라우저 시나리오를 `tests/e2e/presenter-results.spec.ts`에 추가한다

### Implementation for User Story 3

- [ ] T035 [US3] 마지막 질문 완료 시 행사 진행 상태를 `completed`로 저장하고, 완료 전에는 비어 있는 참가자 질답 기록 조회를 `lib/presentation/presentation-service.ts`, `lib/answers/archive-service.ts`, `lib/db/repositories/presentation.ts`에 구현한다
- [ ] T036 [US3] 전체 완료와 빈 질문 상태를 안전한 프로젝터 DTO로 조립하고, 완료 후 참가자용 질문별 답변·작성자 DTO를 `lib/presentation/presentation-view.ts`, `app/api/answers/archive/route.ts`에 구현한다
- [ ] T037 [US3] 질문별 완료 요약과 마지막 답변 뒤 마무리 메시지를 `components/admin/presenter/PresenterController.tsx` 및 `components/admin/presenter/PresenterSummary.tsx`에 구현하고, 참가자 기록 화면을 `app/(participant)/answers/page.tsx`에 구현한다
- [ ] T038 [P] [US3] 프로젝터의 긴 답변·완료 상태·키보드 포커스·움직임 축소 스타일을 `app/globals.css`에 보완한다
- [ ] T039 [US3] T032~T034를 실행하고 전체 질답 완료 검증 결과를 `specs/003-question-answer-sequence/quickstart.md`에 기록한다

**Checkpoint**: 네 질문을 모두 마치면 더 공개할 답변이 없다는 상태가 명확히 남고, 로그인한
참가자는 행사 뒤 질문별 전체 질답을 볼 수 있다. 운영 화면에는 발표 초기화 기능을 두지 않는다.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 실제 행사 환경에서 보안·복구·문서·회귀 검증을 마무리한다.

- [ ] T040 [P] 익명 화면 응답에서 작성자·답변 후보·참가자 식별자가 빠지는지 `tests/unit/presentation-view.test.ts` 및 `tests/integration/security-boundaries.test.ts`에서 최종 점검한다
- [ ] T041 [P] 질문·답변·작성자 스냅샷을 진단 로그에 남기지 않도록 `lib/observability/logger.ts` 및 `tests/integration/security-boundaries.test.ts`를 검토·보완한다
- [ ] T042 [P] 행사 전 네 답변 작성, 진행자용 공개 순서, 완료 후 참가자 기록 열람과 프로젝터 연결 복구를 `README.md` 및 `docs/DEPLOYMENT.md`에 문서화한다
- [ ] T043 마이그레이션·시드·백업 복구를 빈 PostgreSQL volume에서 실행하고 결과를 `specs/003-question-answer-sequence/quickstart.md`에 기록한다
- [ ] T044 lint, typecheck, unit, integration, e2e, production build와 기존 기능 회귀를 실행하고 결과를 `specs/003-question-answer-sequence/quickstart.md`에 기록한다
- [ ] T045 명세·계획·계약과 실제 구현을 대조해 남은 작업을 `specs/003-question-answer-sequence/tasks.md`에 추가하거나 완료 표시한다

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**은 바로 시작할 수 있다.
- **Phase 2**는 Phase 1 뒤 완료해야 하며 모든 사용자 스토리를 막는 기반이다.
- **US1**은 Phase 2 뒤 시작한다. 첫 질문의 `답변 공개 → 작성자 공개` MVP다.
- **US2**는 US1의 답변 완료 상태를 이용하므로 US1 뒤 진행한다.
- **US3**은 US2의 네 질문 전환 위에서 마지막 완료 상태를 추가하므로 US2 뒤 진행한다.
- **Polish**는 원하는 사용자 스토리 구현이 끝난 뒤 진행한다.

### User Story Dependency Graph

```text
Setup → Foundation → US1 (답변·작성자 공개) → US2 (질문 순서·전환) → US3 (전체 마무리) → Polish
```

### Parallel Opportunities

- Setup의 T001~T003은 서로 다른 fixture·DB helper·문서 파일에서 병렬 진행할 수 있다.
- Foundation의 T007은 T004~T006과 다른 입력 검증 파일에서 병렬 진행할 수 있다.
- US1의 T011~T013과 T018~T019, US2의 T022~T024, US3의 T032~T033은 해당 선행 단계 뒤 병렬 진행할 수 있다.
- Polish의 T040~T042는 보안 테스트·로그·문서 파일이 나뉘어 병렬 진행할 수 있다.

## Implementation Strategy

### MVP First

1. Phase 1과 Phase 2를 마친다.
2. US1을 구현해 첫 질문에서 답변과 작성자를 차례대로 공개한다.
3. US1 독립 테스트를 통과시키고 행사 흐름이 맞는지 확인한다.

### Incremental Delivery

1. US1: 한 질문 안의 안정적인 공개 흐름
2. US2: 네 질문의 순서와 전환 게이트
3. US3: 마지막 마무리와 행사 후 재확인
4. Polish: 실제 프로젝터·네트워크·보안 환경 검증

각 체크포인트에서 이전 단계의 테스트가 계속 통과해야 다음 단계로 넘어간다.
