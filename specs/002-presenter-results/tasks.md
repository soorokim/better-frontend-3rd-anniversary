# Tasks: 진행자 결과 발표 화면

**Input**: Design documents from `/specs/002-presenter-results/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml,
quickstart.md

**Tests**: 명세의 독립 검증과 constitution의 명세 기반 개발 절차를 따라 각 사용자 스토리의
테스트를 구현보다 먼저 작성하고 실패를 확인한다.

**Organization**: 작업은 사용자 스토리별로 묶으며, 각 체크포인트에서 그 스토리만으로도
독립적인 행사 진행 가치를 확인할 수 있게 한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 미완료 선행 작업에 의존하지 않고 다른 파일에서 병렬 진행 가능
- **[Story]**: 명세의 사용자 스토리 추적 라벨
- 모든 작업 설명에는 실제 수정 또는 검증 기록 파일 경로를 넣는다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 진행자 데스크톱 흐름과 격리 DB 테스트를 기존 검증 환경에 추가한다.

- [X] T001 [P] 1,366×768 진행자 검증용 Playwright 프로젝트와 환경 기본값을 `playwright.config.ts`에 추가한다
- [X] T002 [P] 진행자 테스트 참가자·답변·관리자 fixture 생성을 `tests/helpers/factories.ts`에 추가한다

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 세 사용자 스토리가 함께 사용하는 저장 구조, 입력 계약과 테스트 정리 기반을 만든다.

**⚠️ CRITICAL**: 이 Phase가 끝나기 전에는 사용자 스토리 구현을 시작하지 않는다.

- [X] T003 [P] 명령 discriminated union과 UUID·boolean·restart 확인 검증을 `lib/validation/presentation.ts`에 정의한다
- [X] T004 PresentationSession·PresentationItem 제약과 관계를 `db/schema.ts`, `db/migrations/0002_presenter_results.sql` 및 `db/migrations/meta/_journal.json`에 추가한다
- [X] T005 T004의 새 테이블을 격리 테스트 초기화·정리 순서에 반영하도록 `tests/helpers/database.ts`를 수정한다
- [X] T006 세션 준비, 질문·행사 경계 조회, 세션 행 잠금과 revision 증가 공통 연산을 `lib/db/repositories/presentation.ts`에 구현한다
- [X] T007 [P] 발표 DTO의 공유 타입과 AvatarView 스냅샷 타입을 `lib/presentation/presentation-view.ts`에 정의한다

**Checkpoint**: 빈 DB와 기존 DB에 마이그레이션을 적용할 수 있고, 테스트마다 발표 상태를 완전히 격리할 수 있다.

---

## Phase 3: User Story 1 - 답변을 하나씩 골라 공개하기 (Priority: P1) 🎯 MVP

**Goal**: 관리자가 제출 현황과 답변을 확인하고 특정 답변 또는 미공개 답변 하나를 골라
익명으로 공개한 뒤 작성자를 공개하거나 다시 숨긴다.

**Independent Test**: 제출 답변 3개와 미제출 참가자 1명을 만든 뒤 관리자 화면에서 4/3/1
현황을 확인하고, 무작위 답변을 익명으로 공개한 다음 정확한 닉네임·캐릭터를 공개한다.

### Tests for User Story 1 ⚠️

> **NOTE: T008~T010을 먼저 작성하고 현재 구현에서 실패하는 것을 확인한다.**

- [X] T008 [P] [US1] 명령 입력 거부와 조작 화면 DTO 상태 계산 단위 테스트를 `tests/unit/presentation-state.test.ts`에 작성한다
- [X] T009 [P] [US1] 관리자·참가자·무세션 권한, Origin·CSRF, 현황·후보 allowlist와 다른 행사 answerId 404 통합 테스트를 `tests/integration/presentation-api.test.ts`에 작성한다
- [X] T010 [P] [US1] 관리자 입장→현황 확인→랜덤 익명 공개→작성자 공개 흐름을 `tests/e2e/presenter-results.spec.ts`에 먼저 작성한다

### Implementation for User Story 1

- [X] T011 [US1] 현재 질문의 전체·제출·미제출 수, 최신 답변 후보와 공개 상태 조회를 `lib/db/repositories/presentation.ts`에 구현한다
- [X] T012 [US1] 특정·무작위 답변 선택 스냅샷과 작성자 공개 상태 변경 트랜잭션을 `lib/presentation/presentation-service.ts`에 구현한다
- [X] T013 [P] [US1] 관리자 전용 조작 상태 GET과 `no-store, private` 응답을 `app/api/admin/presentation/route.ts`에 구현한다
- [X] T014 [P] [US1] Origin·CSRF 검증과 `select_answer`·`select_random`·`set_author_visibility` 명령 POST를 `app/api/admin/presentation/commands/route.ts`에 구현한다
- [X] T015 [P] [US1] 제출 현황 카드와 답변 후보 목록을 `components/admin/presenter/PresenterSummary.tsx` 및 `components/admin/presenter/AnswerQueue.tsx`에 구현한다
- [X] T016 [US1] 현재 답변 미리보기와 랜덤·작성자 공개 조작을 `components/admin/presenter/PresenterController.tsx`에 연결한다
- [X] T017 [US1] 관리자 권한 페이지와 기존 현황판 진입 링크를 `app/admin/presenter/page.tsx` 및 `app/admin/page.tsx`에 추가한다
- [ ] T018 [US1] T008~T010을 실행하고 P1 독립 흐름의 결과를 `specs/002-presenter-results/quickstart.md` Scenario 1·2에 기록한다

**Checkpoint**: 프로젝터 전용 화면 없이도 진행자 화면 안에서 첫 답변을 익명으로 골라 이야기하고 작성자를 공개할 수 있다.

---

## Phase 4: User Story 2 - 발표 순서와 진행 상태 이어가기 (Priority: P2)

**Goal**: 중복 없는 공개 순서, 이전·다음, 의도적 재공개와 명시적 초기화를 제공하고,
새로고침·재시작·새 제출 뒤에도 진행 상태를 잃지 않는다.

**Independent Test**: 답변 3개를 무작위로 모두 공개해 중복이 없음을 확인하고, 이전·다음과
재공개를 수행한 뒤 새로고침과 앱 재시작에서도 현재 답변·순서·작성자 공개 상태가 복구되는지
검증한다.

### Tests for User Story 2 ⚠️

> **NOTE: T019~T021을 먼저 작성하고 P1 구현에서 아직 지원하지 않는 경계가 실패하는지 확인한다.**

- [X] T019 [P] [US2] 무작위 후보 소진, 이전·다음 경계, 작성자 비공개 초기화와 restart 상태 규칙을 `tests/unit/presentation-state.test.ts`에 추가한다
- [X] T020 [P] [US2] 스냅샷 고정·재선택 최신화, 새 제출 반영, 원본 Answer 불변, restart와 컨테이너 재조회 복구를 `tests/integration/presentation-api.test.ts`에 추가한다
- [X] T021 [P] [US2] 두 동시 명령의 무작위 중복 방지·순서 unique·revision 직렬 증가를 `tests/integration/presentation-concurrency.test.ts`에 작성한다
- [X] T022 [US2] 무작위 30개 소진, 이전·다음, 직접 재공개, 새로고침 복구와 새 제출 반영 시나리오를 `tests/e2e/presenter-results.spec.ts`에 추가한다

### Implementation for User Story 2

- [X] T023 [US2] presentation_order 배정, 미공개 후보 제외, 재선택 스냅샷 갱신, 이전·다음과 restart repository 연산을 `lib/db/repositories/presentation.ts`에 구현한다
- [X] T024 [US2] `navigate`·`restart` 명령과 no-current·경계·모두 공개 오류 매핑을 `lib/presentation/presentation-service.ts`에 구현한다
- [X] T025 [US2] `navigate`와 확인된 `restart` 입력을 `app/api/admin/presentation/commands/route.ts`에 연결한다
- [X] T026 [P] [US2] 2초 revision 조회, 단일 in-flight, 재시도 backoff와 세션 만료 상태를 `components/admin/presenter/usePresentationPolling.ts`에 구현한다
- [X] T027 [P] [US2] 공개 순서·현재·미공개 표시와 이전·다음·직접 재공개·초기화 UI를 `components/admin/presenter/AnswerQueue.tsx`에 구현한다
- [X] T028 [US2] polling 상태, 새 답변 안내, 모두 공개·연결 끊김·재인증 안내를 `components/admin/presenter/PresenterController.tsx`에 통합한다
- [ ] T029 [US2] T019~T022 및 기존 답변·PIN 회귀 테스트를 실행하고 결과를 `specs/002-presenter-results/quickstart.md` Scenario 3~6에 기록한다

**Checkpoint**: 진행자 페이지가 실수로 새로고침되거나 앱이 재시작돼도 공개 순서와 현재 답변을 복구하며, 모든 답변을 안전하게 한 번씩 진행할 수 있다.

---

## Phase 5: User Story 3 - 프로젝터에 안전하게 보여주기 (Priority: P3)

**Goal**: 관리자 조작과 미공개 정보를 제외한 현재 질문·슬라이드만 별도 프로젝터 화면에
표시하고, 진행자 변경·연결 중단·세션 만료를 안전하게 반영한다.

**Independent Test**: 진행자와 발표 화면을 서로 다른 브라우저 page로 열어 대기→익명 답변→
작성자 공개→다음 답변을 5초 안에 동기화하고, 비관리자 차단과 1,000자 표시 및 오프라인 복구를
검증한다.

### Tests for User Story 3 ⚠️

> **NOTE: T030~T032를 먼저 작성하고 발표 endpoint와 화면이 없어 실패하는 것을 확인한다.**

- [X] T030 [P] [US3] 대기·익명·작성자 공개 DTO allowlist와 익명 응답의 author 키 완전 생략을 `tests/unit/presentation-view.test.ts`에 작성한다
- [X] T031 [P] [US3] 발표 GET의 관리자 권한, `no-store, private`, ID·후보·미공개 작성자 비노출을 `tests/integration/presentation-api.test.ts`에 추가한다
- [X] T032 [US3] 두 page 5초 동기화, 1,000자·URL·줄바꿈·이모지, 키보드, offline/online과 세션 폐기를 `tests/e2e/presenter-results.spec.ts`에 추가한다

### Implementation for User Story 3

- [X] T033 [US3] 현재 Item 스냅샷을 waiting·anonymous·revealed allowlist로 조립하는 함수를 `lib/presentation/presentation-view.ts`에 구현한다
- [X] T034 [US3] 관리자 전용 발표 상태 GET과 익명 필드 제거 및 `no-store, private` 응답을 `app/api/admin/presentation/screen/route.ts`에 구현한다
- [X] T035 [US3] revision 기반 2초 조회, 마지막 정상 슬라이드 유지, backoff와 재인증 안내를 `components/admin/presenter/PresentationScreen.tsx`에 구현한다
- [X] T036 [US3] 관리자 권한을 확인하는 프로젝터 전용 페이지를 `app/admin/presenter/screen/page.tsx`에 구현한다
- [X] T037 [P] [US3] 1,366×768 전체 화면, 긴 텍스트 wrapping·scroll, 3px 포커스와 reduced-motion 스타일을 `app/globals.css`에 추가한다
- [X] T038 [US3] 새 창 발표 화면 진입과 전체 화면 안내를 `components/admin/presenter/PresenterController.tsx`에 연결한다
- [ ] T039 [US3] T030~T032를 실행하고 P3 독립 흐름 결과를 `specs/002-presenter-results/quickstart.md` Scenario 7에 기록한다

**Checkpoint**: 참석자에게는 현재 공개 슬라이드만 보이며, 진행자 조작 화면과 비공개 후보 정보는 프로젝터로 전달되지 않는다.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 전체 사용자 스토리의 보안, 복구, 문서와 배포 후보 품질을 마무리한다.

- [X] T040 [P] 발표 command 로그 allowlist와 snapshot·nickname·author·avatar redaction 회귀 검증을 `lib/observability/logger.ts` 및 `tests/unit/presentation-view.test.ts`에 추가한다
- [X] T041 [P] 관리자 결과·발표 응답의 캐시·권한·CSRF·비밀값 로그 경계를 `tests/integration/security-boundaries.test.ts`에서 최종 점검한다
- [X] T042 [P] 진행자 페이지 사용법, 프로젝터 준비, 명시적 초기화와 장애 복구를 `README.md` 및 `docs/DEPLOYMENT.md`에 문서화한다
- [ ] T043 전체 구현과 `specs/002-presenter-results/contracts/openapi.yaml`의 경로·상태 코드·필드가 일치하는지 `specs/002-presenter-results/quickstart.md`에 계약 검증 결과를 기록한다
- [ ] T044 빈 volume의 격리 Compose에서 마이그레이션, 발표 상태 백업·복구와 앱 재시작을 실행하고 `specs/002-presenter-results/quickstart.md`에 데이터 보존 결과를 기록한다
- [ ] T045 lint, typecheck, unit, integration, e2e, build와 기존 `001-event-core-flow` 회귀 전체를 실행하고 `specs/002-presenter-results/quickstart.md`에 최종 결과를 기록한다
- [ ] T046 명세·계획·작업 목록과 실제 구현을 대조해 미완료 작업을 `specs/002-presenter-results/tasks.md`에 추가하거나 완료 표시한다

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 바로 시작할 수 있다.
- **Foundational (Phase 2)**: Setup 완료 뒤 진행하며 모든 사용자 스토리를 막는 공통 기반이다.
- **US1 (Phase 3)**: Foundational 완료 뒤 시작한다. 첫 사용 가능한 MVP다.
- **US2 (Phase 4)**: US1의 선택·스냅샷 흐름 위에 순서와 복구를 추가하므로 US1 완료가 필요하다.
- **US3 (Phase 5)**: US1의 현재 슬라이드와 US2의 revision 동기화를 사용하므로 US2 완료가 필요하다.
- **Polish (Phase 6)**: 배포 후보에 포함할 사용자 스토리가 모두 끝난 뒤 진행한다.

### User Story Dependency Graph

```text
Setup → Foundation → US1 (선택·익명 공개 MVP) → US2 (순서·복구) → US3 (프로젝터)
                                                              └→ Polish
```

### Within Each User Story

- 해당 Phase의 테스트를 먼저 작성하고 현재 구현에서 필요한 이유로 실패하는지 확인한다.
- 저장소 연산을 서비스보다 먼저 구현하고, 서비스가 완성된 뒤 route를 연결한다.
- route 계약이 통과한 뒤 화면을 연결하고 독립 E2E까지 통과해야 체크포인트를 넘는다.
- 서버 DTO는 DB row spread 없이 allowlist로 조립하고, 익명 발표 응답은 author 키를 만들지 않는다.
- 각 작은 논리 묶음 뒤 커밋하되 같은 마이그레이션과 schema 변경은 한 커밋에 둔다.

### Parallel Opportunities

- T001과 T002는 서로 다른 테스트 기반 파일에서 병렬 진행할 수 있다.
- T003과 T007은 저장 migration과 독립된 입력·DTO 파일이라 병렬 진행할 수 있다.
- US1의 T008~T010, T013~T015는 각 선행 구간 안에서 서로 다른 파일로 나뉜다.
- US2의 단위·통합 테스트 T019~T021과 UI T026~T027은 각 선행 조건 뒤 병렬 진행할 수 있다.
- US3의 T030~T031과 T037은 서로 다른 테스트·스타일 파일에서 병렬 진행할 수 있다.
- Polish의 T040~T042는 코드·보안 테스트·운영 문서로 나뉘어 병렬 진행할 수 있다.

---

## Parallel Example: User Story 1

```text
Task T008: tests/unit/presentation-state.test.ts에 명령·DTO 단위 테스트 작성
Task T009: tests/integration/presentation-api.test.ts에 권한·계약 통합 테스트 작성
Task T010: tests/e2e/presenter-results.spec.ts에 첫 익명 공개 E2E 작성

T012 완료 뒤:
Task T013: app/api/admin/presentation/route.ts의 조회 route 구현
Task T014: app/api/admin/presentation/commands/route.ts의 command route 구현
Task T015: PresenterSummary.tsx와 AnswerQueue.tsx UI 구현
```

## Parallel Example: User Story 2

```text
Task T019: 상태 경계 단위 테스트 추가
Task T020: 스냅샷·복구 통합 테스트 추가
Task T021: 동시 명령 직렬화 테스트 작성

T025 완료 뒤:
Task T026: usePresentationPolling.ts 동기화 hook 구현
Task T027: AnswerQueue.tsx 순서·이동·초기화 UI 구현
```

## Parallel Example: User Story 3

```text
Task T030: presentation-view.test.ts 익명 DTO 테스트 작성
Task T031: presentation-api.test.ts 발표 endpoint 계약 테스트 작성

T034 완료 뒤:
Task T035: PresentationScreen.tsx 조회·복구 구현
Task T037: app/globals.css 프로젝터·접근성 스타일 구현
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup 완료
2. Phase 2 Foundational 완료
3. Phase 3 US1 완료
4. T008~T010과 quickstart Scenario 1·2 검증
5. 진행자가 답변을 골라 익명으로 이야기하고 작성자를 공개하는 흐름을 시연한 뒤 멈춰 피드백 수집

### Incremental Delivery

1. **진행 MVP**: 제출 현황, 직접·랜덤 선택, 익명·작성자 공개
2. **현장 복구 버전**: 중복 없는 순서, 이전·다음, 새 제출, 새로고침·재시작 복구
3. **프로젝터 버전**: 최소 공개 화면, 두 창 동기화, 오프라인·세션 복구
4. **배포 후보**: 보안·백업·새 설치·전체 회귀 검증

각 체크포인트에서 이전 스토리의 테스트가 계속 통과해야 다음 단계로 넘어간다.

## Notes

- `[P]`는 파일 충돌 없이 병렬로 진행할 수 있다는 뜻이며 Phase 선행 의존성은 유지된다.
- `[US1]`, `[US2]`, `[US3]`는 `spec.md`의 사용자 스토리와 직접 연결된다.
- 테스트는 대응 구현 전에 실패해야 한다.
- 진행 초기화는 명시적 확인 뒤 발표 상태만 지우며 원본 Answer를 절대 변경하지 않는다.
- WebSocket, 공개 화면 토큰, 여러 질문 관리와 답변 편집·삭제는 이 작업 목록에 추가하지 않는다.
