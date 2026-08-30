# Tasks: 대화 기반 개발자 아바타

**Input**: `/specs/003-conversation-avatar/`의 `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: 명세와 계획에서 Python 픽스처, Vitest, Testing Library, Playwright 검증을 요구하므로 테스트 작업을 포함한다. 각 사용자 스토리의 테스트 작업을 먼저 작성하고 실패를 확인한 뒤 구현한다.

**Organization**: 사용자 스토리 번호는 `spec.md`와 같다. 우선순위가 같은 US1과 US3 가운데 확정 프로필 연결을 먼저 완성해야 공개 연출을 붙일 수 있으므로 US1 → US3 순서로 둔다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 선행 작업이 끝난 뒤 다른 파일에서 병렬로 진행 가능
- **[Story]**: `spec.md`의 사용자 스토리 번호
- 체크하기 전 해당 테스트와 완료 조건을 실제로 확인한다.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 전원 분석과 웹앱 검증을 같은 저장소 명령으로 재현할 준비를 한다.

- [X] T001 분석 계약 검증과 테스트 명령을 `package.json` 및 `package-lock.json`에 추가하고 `npm run avatar:validate`, Python 분석 테스트, 컴포넌트 테스트를 로컬과 컨테이너에서 같은 방식으로 실행되게 한다.
- [X] T002 [P] HMAC 키의 이름과 용도, 저장소 밖 주입 원칙을 `.env.example`에 `AVATAR_HASH_KEY` 설명으로 추가하되 실제 값이나 기본 비밀값은 넣지 않는다.
- [X] T003 [P] 실제 닉네임·원본 user ID가 있는 `scripts/private/`, 분석 JSON, 임시 SQLite, 배치 로그가 Git과 Docker 이미지에 들어가지 않도록 `.gitignore`와 `.dockerignore`의 제외 규칙을 보완하고 가짜 값만 든 `scripts/kakao_participants.example.json`만 추적한다.

**Checkpoint**: 필요한 명령과 비밀값 경계가 문서화되고 분석 산출물이 실수로 커밋되지 않는다.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 공유하는 활성 배치, 프로필, 별칭, 결정적 생성 규칙을 만든다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 사용자 스토리 구현을 완료 처리하지 않는다.

- [X] T004 `ConversationProfileBatch`, `ConversationProfile`, `ConversationProfileAlias`와 확정 `ProfileData` 필드를 `db/schema.ts`에 추가하고 배치 상태 enum, 이벤트별 활성 배치·배치별 별칭·선점 참가자 고유 제약을 선언한다. 프로필·별칭에는 별도 검토/차단 상태를 추가하지 않는다.
- [X] T005 T004의 테이블, 외래 키, 부분 고유 인덱스, 기존 대화 프로필 이관 규칙을 재실행 가능한 마이그레이션으로 `db/migrations/0002_conversation_profiles.sql`과 `db/migrations/meta/_journal.json`에 반영한다.
- [X] T006 [P] `contracts/analysis-output.schema.json`과 같은 필드·범위·개인정보 조건을 검사하는 Zod 스키마와 타입을 `lib/validation/conversation-profile.ts`에 만들고 Python JSON과 import 코드가 함께 사용하게 한다.
- [X] T007 [P] 같은 HMAC/생성기 버전의 재현성, 특성별 독립 네임스페이스, 기존 사용자 불변성, 클래스+장비 중복 회피와 근거 없는 형용사·명사 비우기를 검증하는 실패 테스트를 `tests/unit/developer-profile.test.ts`에 작성한다.
- [X] T008 T007을 통과하도록 버전이 고정된 형용사·명사·장비·기본/이스터에그 상태 카탈로그, 표시 해시·DiceBear seed, 결정적 생성기와 다양성 할당기를 `lib/avatar/developer-profile.ts` 및 `lib/avatar/generator.ts`에 완성한다. 근거 있는 후보가 없으면 클래스 필드를 채우지 않는다.
- [ ] T009 [P] 활성 배치만 조회하고 승인 별칭을 한 프로필에 유일하게 연결하며 동시 선점을 막는 저장소 실패 테스트를 `tests/integration/conversation-profile-repository.test.ts`에 작성한다.
- [X] T010 T009를 통과하도록 배치 생성·활성화·이전 배치 유지, 별칭 조회, 준비 상태 확인, 조건부 프로필 선점 기능을 `lib/db/repositories/conversation-profiles.ts`에 구현한다.
- [X] T011 [P] 활성/실패/대체된 배치와 승인 별칭을 독립 테스트에서 만들 수 있는 팩토리를 `tests/helpers/conversation-profiles.ts`와 `tests/fixtures/avatar-analysis/valid-all-participants.json`에 추가한다. 충돌 검토 데이터는 PostgreSQL이 아니라 Python 분석 픽스처에만 둔다.
- [ ] T012 스키마 타입 검사와 마이그레이션 왕복 검증을 `tests/integration/bootstrap.test.ts` 및 `tests/helpers/database.ts`에 추가하고 깨끗한 PostgreSQL에서 적용되는지 확인한다.

**Checkpoint**: 실제 카카오 분석 파일 없이도 테스트 픽스처로 활성 프로필과 가입 허용 별칭을 만들 수 있다.

---

## Phase 3: User Story 1 - 승인된 닉네임으로 나만의 아바타 만들기 (Priority: P1) 🎯 MVP

**Goal**: 활성 배치의 승인된 닉네임만 가입시키고, 확정 대화 프로필을 계정과 원자적으로 연결해 재접속해도 같은 결과를 보여 준다.

**Independent Test**: 초대 코드가 맞아야 닉네임·PIN 단계가 열리는지 확인한다. 테스트 DB에 활성 프로필 한 명을 준비한 뒤 그 별칭으로 가입·재로그인하면 같은 캐릭터가 나오고, 미등록·미준비·이미 선점된 닉네임은 참가자/PIN/아바타를 만들지 않는지 확인한다.

### Tests for User Story 1

- [ ] T013 [P] [US1] 초대 코드 사전 확인의 `200/401/429`, 활성 전체 배치가 없을 때의 `profile_batch_not_ready`, 잘못된 Origin의 `403`, 최종 가입의 `201`, `nickname_not_invited`, `nickname_taken`, 6자리 PIN 확인과 중첩 오류 응답을 검증하는 계약 테스트를 `tests/integration/conversation-avatar-register-api.test.ts`에 작성한다.
- [ ] T014 [P] [US1] 프로필 선점·참가자·PIN·아바타 생성의 전부 성공/전부 롤백과 동시 가입 한 건만 성공하는 통합 테스트를 `tests/integration/conversation-avatar-registration.test.ts`에 작성한다.

### Implementation for User Story 1

- [X] T015 [US1] 이벤트의 활성 전체 배치 존재 여부를 확인하고 그 배치의 승인 별칭으로 프로필을 조회해 조건부 선점할 쿼리를 `lib/db/repositories/conversation-profiles.ts` 및 `lib/db/repositories/participants.ts`에 연결한다.
- [X] T016 [US1] rate limit이 적용된 초대 코드 사전 확인에서 활성 전체 배치가 없으면 `profile_batch_not_ready`로 중단하고, 최종 가입에서 코드와 배치를 다시 검증한 뒤 닉네임 기반 fallback 없이 프로필 선점, 참가자/PIN 생성, conversation avatar 지정이 한 트랜잭션에서 끝나도록 `lib/auth/participant-service.ts`를 수정한다.
- [X] T017 [US1] 기존 참가자가 로그인할 때 임시 nickname 아바타만 대화 기반 확정 아바타로 교체하고 참가자·답변·세션은 유지하도록 `lib/auth/participant-service.ts`와 `lib/db/repositories/participants.ts`를 완성한다.
- [X] T018 [US1] `verifyOrigin`과 rate limit을 적용한 `POST /api/invitations/verify`를 `app/api/invitations/verify/route.ts`에 만들고, 최종 가입 Route Handler도 Origin·초대 코드·활성 배치를 다시 확인하며 확정 아바타와 `reveal` 메타데이터를 반환하도록 `app/api/participants/register/route.ts`와 `lib/http/errors.ts`를 `contracts/openapi.yaml`에 맞춘다.
- [X] T019 [P] [US1] PLAYER, CLASS, ITEM, STATUS, HASH와 터미널 준비 순서가 안전한 공개 데이터만 렌더링하는지 확인하는 컴포넌트 테스트를 `tests/unit/developer-identity-card.test.tsx`에 작성한다.
- [X] T020 [US1] `components/forms/ParticipantAuthForm.tsx`를 초대 코드 확인 → 닉네임·PIN의 두 단계로 만들고, 확정 프로필을 `DeveloperIdentityCard`와 `PixelAvatar`에 연결해 원문·정확한 메시지 수·내부 digest를 노출하지 않도록 `components/avatar/DeveloperIdentityCard.tsx`, `components/avatar/PixelAvatar.tsx`, `app/(participant)/lobby/page.tsx`를 정리한다. 근거 없는 CLASS 값은 `—`로 표시한다.
- [ ] T021 [US1] 초대 코드 단계 차단, 활성 전체 배치가 없을 때의 준비 중 안내, 승인 별칭 가입, 동일 결과 재로그인, 미등록 가입의 구체적인 안내와 DB 부작용 없는 거절을 브라우저에서 검증하는 시나리오를 `tests/e2e/conversation-avatar-onboarding.spec.ts`에 추가한다.

**Checkpoint**: 준비된 승인 사용자만 확정 프로필로 가입하고, 다른 닉네임에는 DB 부작용이 없다.

---

## Phase 4: User Story 3 - 내 프로필이 공개되는 순간 즐기기 (Priority: P1)

**Goal**: 서버 작업을 기다리는 척하지 않으면서 3~5초간 랜덤 후보와 `~하는 중` 문구를 보여 준 뒤 이미 확정된 프로필로 멈춘다.

**Independent Test**: 확정 프로필을 컴포넌트에 넣고 가짜 타이머를 진행하면 후보·문구가 각각 세 종류 이상 바뀐 뒤 정확히 확정값으로 멈추며, 움직임 축소에서는 빠른 전환이 없는지 확인한다.

### Tests for User Story 3

- [X] T022 [P] [US3] 제출 후 1초 안의 준비 상태, 3~5초 범위, 후보/문구 최소 3종, 최종값 불변, 타이머 정리, `prefers-reduced-motion`의 1초 이내 정적 상태를 검증하는 컴포넌트 테스트를 `tests/unit/avatar-reveal.test.tsx`에 작성한다.
- [ ] T023 [P] [US3] 가입 뒤 공개, 공개 중 새로고침, 재접속 뒤 중복 계정·아바타 없음과 확정 결과 일치를 검증하는 E2E 실패 시나리오를 `tests/e2e/avatar-reveal.spec.ts`에 작성한다.

### Implementation for User Story 3

- [X] T024 [P] [US3] 저장되지 않는 임시 클래스·장비·상태·픽셀 seed와 `~하는 중` 문구 목록, 안전한 화면 전환 함수를 `lib/avatar/presentation.ts`에 추가한다.
- [X] T025 [US3] `idle → shuffling → ready` 및 정적 reduced-motion 상태를 구현하고 `aria-live`로 현재 문구를 전달하는 `components/avatar/AvatarReveal.tsx`를 만든다.
- [X] T026 [US3] 가입 성공 시 서버가 준 확정 결과만 보존하고 로비에서 공개 단계를 한 번 시작하도록 `components/forms/ParticipantAuthForm.tsx`와 `app/(participant)/lobby/page.tsx`를 연결하되 SSE, API 지연, 후보 저장을 추가하지 않는다.
- [X] T027 [P] [US3] 360px 화면, 픽셀 전환, 포커스 가시성, reduced-motion 정적 표시 스타일을 `app/globals.css`에 추가한다.
- [ ] T028 [US3] `tests/unit/avatar-reveal.test.tsx`와 `tests/e2e/avatar-reveal.spec.ts`를 실행해 공개 도중 새로고침해도 참가자·확정 아바타가 각각 하나뿐이고 후보 값이 DB에 저장되지 않는지 확인한다.

**Checkpoint**: 공개 연출은 클라이언트에서만 동작하고 계정 생성이나 서버 분석 시간과 분리된다.

---

## Phase 5: User Story 2 - 결과를 눌러 보고 공유하기 (Priority: P2)

**Goal**: 참가자가 마우스·터치·키보드로 카드를 눌러 승인된 개발자 상태 문구를 바꿔 보고 다른 사람에게 보여 줄 수 있다.

**Independent Test**: 프로필 카드만 렌더링해 클릭, Enter, Space로 상태가 승인 목록 안에서 바뀌고 스크린리더가 변화를 읽으며 360px에서도 필드가 잘리지 않는지 확인한다.

### Tests for User Story 2

- [X] T029 [P] [US2] 클릭·Enter·Space, 상태 순환, `aria-live`, 승인 목록 밖 문구 차단을 검증하는 컴포넌트 테스트를 `tests/unit/developer-identity-interaction.test.tsx`에 작성한다.

### Implementation for User Story 2

- [X] T030 [P] [US2] Foundation에서 확정·저장한 승인 상태 목록만 안전하게 순환하고 빈 목록을 처리하는 표시 헬퍼를 `lib/avatar/presentation.ts`에 구현한다. 카탈로그나 저장된 프로필 버전은 이 단계에서 바꾸지 않는다.
- [X] T031 [US2] 저장된 승인 상태만 순환하고 현재 상태를 보조기기에 알리도록 `components/avatar/DeveloperIdentityCard.tsx`의 버튼·키보드·라이브 영역을 완성한다.
- [X] T032 [P] [US2] 긴 클래스/장비 문구와 HASH가 360px에서 잘리지 않고 터치 영역이 충분하도록 `app/globals.css`의 개발자 카드 스타일을 보완한다.
- [ ] T033 [US2] 모바일·키보드 전용 상호작용과 상태 공유 동작을 `tests/e2e/accessibility.spec.ts` 및 `tests/e2e/conversation-avatar-onboarding.spec.ts`에서 검증한다.

**Checkpoint**: 프로필 카드는 재미있는 상호작용을 제공하면서 마우스 없이도 완전히 사용할 수 있다.

---

## Phase 6: User Story 4 - 대화를 노출하지 않고 프로필 갱신하기 (Priority: P3)

**Goal**: 카카오 아카이브 안에서 메시지가 있는 비시스템 사용자 전원을 분석하고, 원문 없는 전체 배치를 검증·원자적 import·운영자 검토한다.

**Independent Test**: 시스템/메시지 0명/명단 밖 사용자/승인 별칭/같은 정규화 키 충돌이 섞인 SQLite로 분석한다. 충돌은 자동 병합되지 않고 별도 검토 목록으로 나오며, 사용자가 승인한 별칭 규칙으로 재분석한 뒤에만 원문 없는 전체 JSON이 한 배치로 활성화되는지 확인한다.

### Tests for User Story 4

- [X] T034 [P] [US4] 전원 자동 발견, 시스템·메시지 0명 제외, 서버 전용 승인 별칭만 병합, 같은 정규화 키 충돌의 로컬 `merge_review` 출력, HMAC 재현성, 깨끗한 프로필에서 원본 user ID·본문 비반출과 저자료 사용자의 근거 없는 후보 비우기를 검사하는 Python 테스트를 `tests/test_analyze_kakao_profiles.py`와 `tests/fixtures/avatar-analysis/`에 작성한다.
- [ ] T035 [P] [US4] JSON 전체 선검증, `source_row_count` 합계와 `source_user_count` 일치, 원본 user ID 또는 `merge_review`가 든 파일 거절, 인원 수가 달라도 승인 병합 내역이 완전하면 허용, 한 트랜잭션 활성화, 재import 멱등성과 이전 배치 유지를 검증하는 통합 테스트를 `tests/integration/conversation-profile-import.test.ts`에 작성한다.
- [ ] T036 [P] [US4] 인증된 운영자만 원문·digest·원본 user ID·개인별 정확한 메시지 수 없이 활성 배치, 준비/가입 상태, 승인 병합 별칭과 `sourceRowCount`를 받는 계약 테스트를 `tests/integration/admin-avatar-profiles-api.test.ts`에 작성한다.

### Implementation for User Story 4

- [X] T037 [US4] SQLite를 `mode=ro`로 열고 `--all-participants`에서 메시지가 있는 비시스템 사용자를 전부 순회하되 동일 정규화 키를 자동 병합하지 않고 LXC 안의 `merge_review`로 출력한다. 서버 전용 승인 규칙의 `source_user_ids`로만 충돌 사용자를 합치거나 분리하고, 깨끗한 프로필에는 `source_row_count`·승인 별칭·요약 통계·상대 신호·근거 있는 후보·HMAC만 쓰도록 `scripts/analyze_kakao_profiles.py`를 완성한다.
- [X] T038 [P] [US4] 가짜 값만 든 `scripts/kakao_participants.example.json`에 승인 규칙 스키마를 문서화하고 실제 별칭·원본 user ID 규칙은 gitignore된 `scripts/private/kakao_participants.json`에서만 관리한다. 검토 → 사용자 승인 → 규칙 수정 → 전체 재분석 절차와 서로 다른 행사 가입 닉네임 지정 방법을 `scripts/README.md`에 기록한다.
- [X] T039 [US4] `selection`, `source_user_count`, `source_row_count`, `source_aliases`, privacy 조건을 검증하고 원본 user ID·`unmatched`·`merge_review`가 없는 깨끗한 파일만 확정 프로필·별칭·배치로 한 트랜잭션 저장한 뒤 활성화하도록 `scripts/import-conversation-profiles.ts`를 교체한다.
- [X] T040 [US4] 활성 배치 요약과 프로필별 준비/가입 상태, 승인 병합 별칭과 원본 행 개수를 원문 없는 DTO로 만드는 조회 기능을 `lib/db/repositories/conversation-profiles.ts`와 `lib/auth/admin-service.ts`에 추가한다.
- [X] T041 [US4] 운영자 인증과 `Cache-Control: no-store`를 적용한 `GET /api/admin/avatar-profiles`를 `app/api/admin/avatar-profiles/route.ts`에 구현한다.
- [X] T042 [US4] 원본 사용자 행 수, 별칭 병합 후 프로필 수, 준비·가입 상태와 프로필별 병합 별칭·원본 행 개수를 보여 주는 읽기 전용 화면을 `components/admin/AvatarProfileStatus.tsx`와 `app/admin/page.tsx`에 추가한다. 충돌 수정은 이 화면이 아니라 재분석 절차로 처리한다.
- [ ] T043 [US4] `specs/003-conversation-avatar/quickstart.md` 순서대로 LXC 108의 `/opt/kakao-archive-next/data/archive.sqlite3`에 `scripts/analyze_kakao_profiles.py --all-participants`를 실행한다. 로컬 `merge_review`가 있으면 목록을 사용자에게 제시해 승인을 받고 서버 전용 별칭 규칙 수정과 전체 재분석을 거친 뒤, user ID가 없는 깨끗한 JSON만 백업 후 행사 DB에 import해 원본 행 개수와 병합 내역이 설명되는지 확인한다.

**Checkpoint**: 실제 대화 원문은 LXC를 떠나지 않고, 검증된 전원 프로필만 행사 DB의 활성 배치가 된다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 개인정보, 성능, 모바일, 설치 재현성을 마지막으로 묶어 확인한다.

- [X] T044 [P] 행사 서버용 분석 JSON, PostgreSQL, API 응답, 애플리케이션 로그에 원본 user ID, `body`, 메시지 전문, PIN, 초대 코드, 세션, HMAC 키가 남지 않는 회귀 검사를 `tests/integration/conversation-avatar-privacy.test.ts`에 추가한다.
- [ ] T045 [P] 360px·터치·키보드·고대비·reduced-motion 전체 흐름을 `tests/e2e/accessibility.spec.ts`와 `tests/e2e/avatar-reveal.spec.ts`에서 검증한다.
- [X] T046 [P] 전체 분석 15분 이내, 가입 API p95 2초 이내, 제출 후 준비 상태 1초 이내, 최종 공개 p95 7초 이내를 확인할 측정 명령 및 민감정보 없는 결과 형식을 `scripts/benchmark-conversation-avatars.md`에 기록한다.
- [ ] T047 Docker Compose 마이그레이션, 서버 전용 별칭 파일 준비, 분석/import, 활성 배치 확인, 백업·복구 절차를 `README.md`, `DEPLOYMENT.md`, `specs/003-conversation-avatar/quickstart.md`에 반영하고 깨끗한 서버 설치 순서로 한 번 검증한다.
- [ ] T048 `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run test:e2e`, Python 분석 테스트, `git diff --check`를 실행하고 실패 항목을 모두 고친 뒤 `specs/003-conversation-avatar/checklists/requirements.md`를 최종 확인한다.

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 Setup
    ↓
Phase 2 Foundation
    ├──→ US1 확정 프로필 가입 ──→ US3 공개 연출
    │                         └──→ US2 카드 상호작용
    └──→ US4 전원 분석/import ──→ 실제 행사 데이터 준비
                                      ↓
                              Polish / 운영 검증
```

- **Setup**은 바로 시작할 수 있다.
- **Foundation**은 Setup 이후 진행하며 모든 스토리를 막는 공통 선행 단계다.
- **US1**은 Foundation의 테스트 프로필로 독립 완료할 수 있다.
- **US3**과 **US2**는 US1의 확정 프로필 표시를 사용하므로 US1 뒤에 진행한다. 두 스토리는 서로 병렬 가능하다.
- **US4**의 분석/import 구현은 Foundation 뒤 US1과 병렬로 진행할 수 있다. 실제 공개 배포는 T043의 전원 import가 끝나야 한다.
- **Polish**는 배포하려는 모든 스토리가 끝난 뒤 진행한다.

### Within Each User Story

- 테스트를 먼저 작성하고 해당 기능이 없어 실패하는 것을 확인한다.
- 스키마·모델 → 저장소 → 서비스 → API → UI → 통합/E2E 순서를 지킨다.
- 배치 import와 가입 트랜잭션은 중간 상태를 성공으로 처리하지 않는다.
- 각 Checkpoint에서 독립 테스트를 통과한 뒤 다음 단계로 간다.

### Parallel Opportunities

- Setup의 T002와 T003은 T001과 다른 파일에서 병렬로 진행할 수 있다.
- Foundation의 계약(T006), 생성기 테스트(T007), 저장소 테스트(T009), 테스트 팩토리(T011)는 스키마 설계가 합의된 뒤 서로 병렬 가능하다.
- US1의 API 계약(T013), 트랜잭션 테스트(T014), 컴포넌트 테스트(T019)는 병렬 작성 가능하다.
- US3의 컴포넌트/E2E 테스트(T022~T023)와 카탈로그·스타일(T024, T027)은 파일 충돌 없이 나눌 수 있다.
- US2의 상호작용 테스트(T029), 상태 순환 표시 헬퍼(T030), CSS(T032)는 병렬 가능하다.
- US4의 Python 테스트(T034), import 테스트(T035), 운영자 API 테스트(T036)는 병렬 가능하고, 분석기 문서(T038)도 별도 진행할 수 있다.
- Foundation 이후 US1과 US4를 동시에 진행할 수 있지만 T043 실제 import는 T039~T042 이후 실행한다.

## Parallel Examples

### User Story 1

```text
Task T013: 가입 API 계약 테스트
Task T014: 가입 원자성·동시성 통합 테스트
Task T019: 최종 프로필 카드 컴포넌트 테스트
```

### User Story 3

```text
Task T022: AvatarReveal 타이머·접근성 테스트
Task T023: 새로고침·재접속 E2E 테스트
Task T024: 임시 후보와 진행 문구 카탈로그
Task T027: 모바일/reduced-motion 스타일
```

### User Story 2

```text
Task T029: 카드 키보드·상태 순환 테스트
Task T030: 저장된 승인 상태의 순환 표시 헬퍼
Task T032: 360px 카드 스타일
```

### User Story 4

```text
Task T034: Python 전원 분석 테스트
Task T035: 원자적 import 통합 테스트
Task T036: 운영자 상태 API 계약 테스트
Task T038: 별칭 운영 문서
```

## Implementation Strategy

### MVP First

1. Phase 1과 Phase 2를 완료한다.
2. US1만 구현하고 테스트 픽스처의 승인 사용자로 가입·재로그인을 검증한다.
3. 여기서 멈추면 대화 기반 프로필 연결이라는 핵심은 시연할 수 있다.
4. 실제 행사 배포에는 US4의 T043까지 반드시 완료해 전원 활성 배치를 준비한다.

### Incremental Delivery

1. **기반 + US1**: 승인된 사용자만 확정 프로필로 가입한다.
2. **US3**: 가입 직후의 3~5초 공개 연출을 붙인다.
3. **US2**: 상태 문구 상호작용과 모바일 공유 재미를 붙인다.
4. **US4**: 전체 아카이브 분석/import와 운영자 검토 화면을 완성하고 실제 전원을 사전 계산한다.
5. **Polish**: 개인정보, 성능, 백업·복구, 설치 재현성을 한 번에 검증한다.

## Notes

- 부분 구현된 파일도 해당 작업의 완료 조건과 테스트를 통과하기 전에는 체크하지 않는다.
- `[P]`는 파일 충돌과 직접 선행 의존성이 없는 작업만 표시했다.
- 분석 대상은 고정 인원 명단이 아니라 메시지가 하나 이상인 비시스템 사용자 전원이다.
- 별칭 파일은 대상 필터가 아니라 확인된 닉네임 변경을 한 프로필로 합치는 규칙이다.
- 공개 연출을 위해 SSE, WebSocket, 의도적인 API 지연을 추가하지 않는다.
- 분석 산출물과 비밀값은 커밋하지 않는다.
