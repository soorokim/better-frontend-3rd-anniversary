---

description: "모듈형 픽셀 아바타 재구성 구현 작업"
---

# Tasks: 모듈형 픽셀 아바타 재구성

**Input**: Design documents from `/specs/005-rebuild-avatar-parts/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: 명세의 독립 검증과 성공 기준에 자동 검사, 브라우저 검사와 사람 승인이 포함되어 있으므로 각 사용자 스토리에 테스트 작업을 포함한다.

**Organization**: 작업은 사용자 스토리별로 묶는다. 대표 4개 승인과 전체 조합 승인은 실제 사용자 확인이 필요한 강제 중단 지점이다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 선행 작업이 끝난 뒤 다른 파일을 수정하므로 병렬 실행 가능
- **[Story]**: `spec.md`의 사용자 스토리 번호
- 모든 작업은 수정하거나 생성할 정확한 저장소 상대 경로를 포함한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 현재 프로젝트에 재현 가능한 에셋 제작·검사 도구를 추가한다.

- [X] T001 Add `sharp` as an explicit dev dependency and add the `avatar:assets:validate` script in `package.json` and `package-lock.json`
- [X] T002 [P] Pin the offline Pillow authoring dependency and usage note in `scripts/requirements-avatar.txt` and `scripts/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 기존 배정값을 동결하고 모든 사용자 스토리가 공유할 manifest 해석·검증 기반을 만든다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 새 에셋을 만들거나 렌더러를 바꾸지 않는다.

- [X] T003 Capture stable generator inputs, digests and all catalog ID orders without changing production constants in `tests/fixtures/avatar-assignments-v1.json`
- [X] T004 Write the 1,200-combination assignment and version regression test against the frozen fixture in `tests/unit/avatar-assignment-regression.test.ts`
- [X] T005 [P] Implement Zod types, phase guards and deterministic manifest lookup from the data model in `lib/avatar/assets/manifest.ts`
- [X] T006 [P] Create the `pixel-layers-v3` pilot manifest skeleton with canvas, layer order, aliases, pilot cases, provenance and pending review fields in `lib/avatar/assets/pixel-layers-v3.json`
- [X] T007 Preserve stored trait normalization while resolving accessory and `developerItem` aliases to canonical visual item IDs in `lib/avatar/presentation.ts`
- [X] T008 Implement manifest/schema, file, checksum, RGBA, hard-alpha, bounds, mask-overlap and canonical-combination checks in `scripts/validate-avatar-assets.ts`
- [X] T009 [P] Replace LANCZOS/chroma-edge output with nearest-neighbor export and hard-alpha quantization in `scripts/extract_avatar_atlas.py`
- [X] T010 Add unit coverage for schema validation, alias completeness, phase activation guards and the 2,160 canonical render keys in `tests/unit/avatar-assets.test.ts`

**Checkpoint**: 기존 카탈로그·생성기 불변성, manifest 계약과 검사기가 준비됐다. 아직 새 에셋이나 운영 렌더러는 활성화하지 않는다.

---

## Phase 3: User Story 1 - 대표 아바타 조합을 먼저 승인하기 (Priority: P1) 🎯 MVP

**Goal**: 공통 골격으로 만든 대표 조합 4개를 관리자 전용 화면에서 실제 크기로 보고 승인하거나 반려할 수 있다.

**Independent Test**: `phase=pilot` 상태에서 관리자만 `/admin/avatar-review?mode=pilot`에 접근해 네 조합을 360px 로비와 48/52/76/80/192px 문맥으로 확인하고, 실패가 하나라도 있으면 전체 제작으로 넘어가지 않는다.

### Tests for User Story 1

> **NOTE**: 아래 테스트를 먼저 작성하고, 새 에셋·검토 화면을 만들기 전 실패를 확인한다.

- [X] T011 [P] [US1] Write manifest pilot-case coverage and approval-gate tests for exactly four risk-diverse cases in `tests/unit/avatar-review-manifest.test.ts`
- [X] T012 [P] [US1] Write Playwright checks for admin authentication, four pilot cards, 360px layout and 48/52/76/80/192px contexts in `tests/e2e/avatar-visual.spec.ts`

### Implementation for User Story 1

- [X] T013 [US1] Create the common 128×192 logical skeleton, source prompt/atlas, complete fallback and face/torso validation masks in `public/avatar-parts/pixel-layers-v3-source.prompt.md`, `public/avatar-parts/pixel-layers-v3-source.png` and `public/avatar-parts/v3/`
- [X] T014 [P] [US1] Produce the three body-only pilot layers from the approved common skeleton in `public/avatar-parts/v3/body-light.png`, `public/avatar-parts/v3/body-warm.png` and `public/avatar-parts/v3/body-deep.png`
- [X] T015 [P] [US1] Produce hair-only front/back pilot layers for `short`, `wave`, `spike` and `cap` without face pixels in `public/avatar-parts/v3/hair-*-front.png` and `public/avatar-parts/v3/hair-*-back.png`
- [X] T016 [P] [US1] Produce garment-only pilot layers for all four outfits without skin, hands or feet in `public/avatar-parts/v3/outfit-hoodie.png`, `public/avatar-parts/v3/outfit-sweater.png`, `public/avatar-parts/v3/outfit-jacket.png` and `public/avatar-parts/v3/outfit-overalls.png`
- [X] T017 [P] [US1] Produce object-only pilot layers for `duck`, `browser-tabs`, `usb` and `test-check` without hands in `public/avatar-parts/v3/item-duck.png`, `public/avatar-parts/v3/item-browser-tabs.png`, `public/avatar-parts/v3/item-usb.png` and `public/avatar-parts/v3/item-test-check.png`
- [X] T018 [US1] Fill pilot file paths, content bounds, SHA-256 values and provenance references in `lib/avatar/assets/pixel-layers-v3.json`
- [X] T019 [P] [US1] Implement reusable pilot cards and the actual 48/52/76/80/192px context previews in `components/avatar/AvatarReviewGrid.tsx`
- [X] T020 [US1] Add the existing-admin-session-protected pilot review page and admin navigation link in `app/admin/avatar-review/page.tsx` and `app/admin/page.tsx`
- [X] T021 [US1] Reuse the review grid in the development-only lab without exposing the pilot through participant query parameters in `app/avatar-lab/page.tsx`
- [X] T022 [US1] Run static and Playwright pilot checks, save element-level evidence, and fill every pending criterion without marking approval in `specs/005-rebuild-avatar-parts/validation/pilot-review.md` and `tests/e2e/avatar-visual.spec.ts-snapshots/`
- [X] T023 [US1] **USER APPROVAL GATE — PAUSE IMPLEMENTATION**: show the four pilot combinations to the user, record pass/fail and notes in `specs/005-rebuild-avatar-parts/validation/pilot-review.md`, and continue only when all four are explicitly approved

**Checkpoint**: 대표 4개가 승인되어 공통 골격, 파츠 경계와 시각 기준이 고정됐다. 이것이 이번 기능의 첫 MVP다.

---

## Phase 4: User Story 2 - 참가자가 선명하고 자연스러운 내 캐릭터 보기 (Priority: P1)

**Goal**: 승인된 기준으로 전체 파츠 후보와 원자적 렌더러를 완성하고, 격리된 모바일 로비에서 기존 프로필 값이 그대로인 선명한 전신 캐릭터를 확인한다.

**Independent Test**: 기존 fixture 참가자로 360px 로비에 접속해 해시·클래스·상태·아이템·traits가 바뀌지 않고, 새 후보 렌더러의 전신이 2초 안에 잘림이나 부분 레이어 없이 표시되는지 확인한다. 운영 활성화는 아직 하지 않는다.

### Tests for User Story 2

- [ ] T024 [P] [US2] Extend component tests for the renderer DOM contract, canonical combination, asset-set state and all-layers-ready transition in `tests/unit/pixel-avatar.test.tsx`
- [ ] T025 [P] [US2] Write a 360px candidate-asset lobby test covering refresh, relogin, profile invariants, crisp element geometry and the two-second target in `tests/e2e/avatar-lobby-v3.spec.ts`

### Implementation for User Story 2

- [ ] T026 [P] [US2] Produce the remaining `bob` hair-only front/back files against the approved skeleton in `public/avatar-parts/v3/hair-bob-front.png` and `public/avatar-parts/v3/hair-bob-back.png`
- [ ] T027 [P] [US2] Produce the remaining object-only `coffee`, `keyboard`, `laptop` and `error-log` files without hands in `public/avatar-parts/v3/item-coffee.png`, `public/avatar-parts/v3/item-keyboard.png`, `public/avatar-parts/v3/item-laptop.png` and `public/avatar-parts/v3/item-error-log.png`
- [ ] T028 [US2] Complete all part records, canonical aliases, checksums, provenance and `phase=pilot` full-catalog data in `lib/avatar/assets/pixel-layers-v3.json`
- [ ] T029 [US2] Implement full-canvas image preloading and an all-layers-ready transition without per-layer transforms in `components/avatar/AvatarAssetLayers.tsx`
- [ ] T030 [US2] Refactor `PixelAvatar` to preserve its public props and accessible label while exposing combination, asset-set and render-state attributes in `components/avatar/PixelAvatar.tsx`
- [ ] T031 [P] [US2] Make the 2:3 art viewport land on integer geometry at 48/52/76/80/192px and keep nearest-neighbor presentation in `app/globals.css`
- [ ] T032 [US2] Preserve the existing reveal and reduced-motion behavior while preventing candidate-layer flicker in `components/avatar/AvatarReveal.tsx`
- [ ] T033 [US2] Run the candidate renderer only in the isolated test/review path, pass the mobile lobby test, and record timing and profile-invariant evidence in `specs/005-rebuild-avatar-parts/validation/mobile-lobby.md`
- [ ] T034 [US2] Re-run the frozen assignment fixture and existing avatar unit suite and record zero profile or trait changes in `specs/005-rebuild-avatar-parts/validation/assignment-regression.md`

**Checkpoint**: 참가자 경험은 격리 환경에서 완성됐지만 `v3`는 아직 운영 기본값이 아니다. 전체 조합 검토와 fallback이 끝날 때까지 `v2`를 유지한다.

---

## Phase 5: User Story 3 - 모든 조합에서 같은 품질 유지하기 (Priority: P2)

**Goal**: 2,160개 고유 화면 조합과 기존 1,200개 배정을 전수 검사하고, 사람 검토까지 통과한 에셋 세트를 승인 상태로 만든다.

**Independent Test**: `mode=parts`와 `mode=all`에서 모든 파츠·조합을 검토하고, 자동 검사에서 누락·가림·경계·alias·fallback 오류가 0건이며 기존 배정 변경도 0건인지 확인한다.

### Tests for User Story 3

- [ ] T035 [P] [US3] Extend exhaustive unit coverage for all required part IDs, 2,160 canonical compositions, 1,200 stored assignments and activation refusal without approval in `tests/unit/avatar-assets.test.ts`
- [ ] T036 [P] [US3] Write participant/admin/controller/presenter combination-parity tests using the real 192/76/52/80px consumers in `tests/e2e/avatar-context-parity.spec.ts`

### Implementation for User Story 3

- [ ] T037 [US3] Add role filters, paginated 2,160-combination review and pilot/full phase labels to `components/avatar/AvatarReviewGrid.tsx` and `app/admin/avatar-review/page.tsx`
- [ ] T038 [US3] Generate deterministic part sheets and paginated full-combination contact sheets from the validator in `scripts/validate-avatar-assets.ts` and `specs/005-rebuild-avatar-parts/validation/contact-sheets/`
- [ ] T039 [US3] Run the complete static, unit and browser matrix and record zero missing files, face intersections, over-30% torso intersections, clipping and unexpected fallback in `specs/005-rebuild-avatar-parts/validation/full-matrix.md`
- [ ] T040 [US3] **USER APPROVAL GATE — PAUSE IMPLEMENTATION**: show the part and contact-sheet review to the user, record the final decision in `specs/005-rebuild-avatar-parts/validation/full-review.md`, and continue only after explicit approval
- [ ] T041 [US3] After T040 approval, set manifest `phase` and review metadata to `approved` without changing the active renderer yet in `lib/avatar/assets/pixel-layers-v3.json`
- [ ] T042 [US3] Pass the real-consumer context parity and refresh/relogin checks and record the results in `specs/005-rebuild-avatar-parts/validation/context-parity.md`
- [ ] T043 [US3] Reconcile the stored 1,200 assignment count and rendered 2,160 canonical composition count in `public/avatar-parts/README.md`

**Checkpoint**: 전체 에셋은 승인됐고 모든 조합이 검증됐다. 에셋 장애 시 완성본 fallback이 확인될 때까지 운영 기본값 전환은 보류한다.

---

## Phase 6: User Story 4 - 일부 에셋 문제에도 완성된 대체 캐릭터 보기 (Priority: P3)

**Goal**: 어느 레이어가 실패해도 부분 캐릭터를 노출하지 않고 완성된 fallback을 유지하며, 관리자만 안전한 실패 식별자를 본다.

**Independent Test**: body, hair, outfit과 item 요청을 하나씩 차단했을 때 참가자는 완성된 fallback 하나만 보고, 관리자 검토 화면에는 `role:id`만 나타나며 닉네임·해시·대화 정보가 노출되지 않는지 확인한다.

### Tests for User Story 4

- [ ] T044 [P] [US4] Write loading, unknown-ID, timeout and per-layer-error fallback tests with participant diagnostic redaction in `tests/unit/pixel-avatar.test.tsx`
- [ ] T045 [P] [US4] Write Playwright fault injection for body, hair, outfit and item requests in `tests/e2e/avatar-fallback.spec.ts`

### Implementation for User Story 4

- [ ] T046 [US4] Implement timeout/error collection and atomic replacement with `fallback-default.png` in `components/avatar/AvatarAssetLayers.tsx` and `components/avatar/PixelAvatar.tsx`
- [ ] T047 [US4] Show only failed role, part ID and reason on the protected review surface while redacting participant diagnostics in `components/avatar/AvatarReviewGrid.tsx`
- [ ] T048 [US4] Run all four fault cases and record zero partial avatars and zero sensitive diagnostic fields in `specs/005-rebuild-avatar-parts/validation/fallback.md`

**Checkpoint**: 정상 조합과 에셋 장애 상황이 모두 준비됐다. 이제 승인된 `v3`를 운영 기본값으로 전환할 수 있다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 승인본 활성화, 문서 정합성, 전체 회귀와 자체 호스팅 결과를 마무리한다.

- [ ] T049 Activate only the approved `pixel-layers-v3` manifest while keeping `/avatars/pixel-art` and all stored generator/catalog versions unchanged in `lib/avatar/assets/manifest.ts` and `components/avatar/PixelAvatar.tsx`
- [ ] T050 Update actual runtime asset usage, authoring steps, provenance, redistribution terms and validation commands in `README.md`, `public/avatar-parts/README.md` and `THIRD_PARTY_NOTICES.md`
- [ ] T051 Run every command in the feature quickstart, the full unit/integration/E2E suite and production build, and record results plus the two-second measurement in `specs/005-rebuild-avatar-parts/validation/final-report.md`
- [ ] T052 Build and start the disposable `avatar-005` Compose project, verify `/public/avatar-parts/v3` and health without touching an operating volume, and record clean-server evidence in `specs/005-rebuild-avatar-parts/validation/docker.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 바로 시작할 수 있다.
- **Foundational (Phase 2)**: Setup 완료 뒤 진행하며 모든 사용자 스토리를 막는다.
- **US1 (Phase 3)**: Foundation 완료 뒤 진행한다. T013이 공통 골격을 만든 뒤 T014~T017을 병렬로 할 수 있다.
- **US2 (Phase 4)**: T023에서 사용자가 대표 4개를 승인해야 시작할 수 있다.
- **US3 (Phase 5)**: US2의 전체 후보 파츠와 렌더러가 필요하다.
- **US4 (Phase 6)**: US2 렌더러가 필요하며, 작업 인력이 있으면 US3의 전체 검토와 병렬로 진행할 수 있다.
- **Polish (Phase 7)**: T040 전체 승인, US3, US4가 모두 끝나야 시작한다.

### User Story Dependency Graph

```text
Setup → Foundation → US1 대표 4개 → [사용자 승인 T023] → US2 전체 후보/모바일
                                                        ├──→ US3 전수검사 → [사용자 승인 T040] ──┐
                                                        └──→ US4 완성본 fallback ────────────────┤
                                                                                                  └→ 운영 활성화
```

### User Story Dependencies

- **US1 (P1)**: Foundation 외 의존성이 없으며 대표 4개 승인만으로 독립적인 MVP다.
- **US2 (P1)**: US1의 승인된 골격이 필요하지만 운영 활성화 없이 격리 모바일 로비에서 독립 검증한다.
- **US3 (P2)**: US2의 전체 후보 파츠가 필요하며 승인 결과를 만들되 운영 전환은 하지 않는다.
- **US4 (P3)**: US2의 원자적 렌더러가 필요하며 US3과 병렬 가능하다.
- **운영 전환**: US3 최종 승인과 US4 fallback 성공을 모두 요구한다.

### Within Each User Story

- 테스트 작업을 먼저 작성하고 구현 전 실패를 확인한다.
- 공통 골격을 확정한 뒤 역할별 파츠를 병렬 제작한다.
- manifest는 실제 파일과 checksum이 준비된 뒤 갱신한다.
- 자동 검사가 성공해도 사람 승인 작업을 대신 완료 처리하지 않는다.
- 승인되지 않은 candidate를 참가자 운영 화면의 기본값으로 바꾸지 않는다.

## Parallel Opportunities

- T001과 T002는 서로 다른 의존성 파일을 다루므로 병렬 가능하다.
- Foundation에서는 T005와 T006, T009를 나눠 진행할 수 있다.
- US1 테스트 T011/T012와 공통 UI T019는 독립 파일에서 진행할 수 있다.
- T013 공통 골격 이후 body T014, hair T015, outfit T016, item T017 제작은 병렬 가능하다.
- US2의 남은 hair T026과 item T027, CSS T031은 병렬 가능하다.
- US3 테스트 T035/T036은 병렬 가능하다.
- US2가 끝나면 US3 전체 검토와 US4 fault handling을 다른 작업자가 병렬로 진행할 수 있다.
- 최종 문서 T050은 활성화 코드 T049 뒤에 실제 동작과 대조해 갱신한다.

## Parallel Example: User Story 1

```text
Task: "T014 [US1] Produce the three body-only pilot layers in public/avatar-parts/v3/body-*.png"
Task: "T015 [US1] Produce four pilot hair front/back layers in public/avatar-parts/v3/hair-*-*.png"
Task: "T016 [US1] Produce four garment-only outfit layers in public/avatar-parts/v3/outfit-*.png"
Task: "T017 [US1] Produce four object-only item layers in public/avatar-parts/v3/item-*.png"
```

## Parallel Example: User Stories 3 and 4

```text
Task: "T035/T036 [US3] Build exhaustive composition and context-parity tests"
Task: "T044/T045 [US4] Build fallback unit and browser fault-injection tests"
```

---

## Implementation Strategy

### MVP First: 대표 4개 승인까지만

1. Phase 1 Setup을 끝낸다.
2. Phase 2 Foundation으로 기존 배정값과 manifest 계약을 고정한다.
3. Phase 3 US1에서 대표 4개와 검토 화면만 만든다.
4. T023에서 멈추고 사용자가 휴대폰 화면을 직접 확인한다.
5. 반려되면 대표 4개만 수정하며 전체 에셋을 만들지 않는다.

### Incremental Delivery

1. **Pilot MVP**: Setup + Foundation + US1 → 대표 4개 사용자 승인
2. **참가자 후보**: US2 → 전체 파츠와 모바일 로비를 격리 검증
3. **전체 품질**: US3 → 2,160개 화면 조합과 1,200개 배정 회귀, 사용자 최종 승인
4. **복구성**: US4 → 누락·오류 때 완성본 fallback
5. **운영 전환**: 모든 게이트 통과 뒤에만 `pixel-layers-v3` 활성화

### Agent Execution Guidance

- 에셋 생성 작업은 `imagegen` 지침을 사용하되 생성 결과를 그대로 런타임에 넣지 않고 공통 격자와 역할 소유권에 맞게 정리한다.
- T023과 T040은 자동화나 에이전트가 승인으로 대신 체크할 수 없다. 사용자 답변을 기다린다.
- 운영 DB와 운영 Compose volume은 어떤 테스트에도 사용하지 않는다.
- 여러 에이전트가 병렬 작업할 때 manifest와 `PixelAvatar.tsx` 담당자는 한 명으로 두어 충돌을 피한다.

## Notes

- `[P]`는 명시된 선행 작업 이후 서로 다른 파일에서 병렬 실행할 수 있다는 뜻이다.
- 각 작업은 완료 뒤 관련 테스트나 검사 결과가 실제로 통과해야 체크한다.
- 이미지 파일의 출처, prompt와 수정 방식은 생성과 같은 작업에서 기록한다.
- DB migration, 새 API, 새 참가자 배정 버전은 이번 범위에 포함하지 않는다.
- 승인 전 `v2`, 승인 후 `v3`라는 복구 가능한 전환 경계를 유지한다.
