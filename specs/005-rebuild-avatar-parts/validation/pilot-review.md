# Pixel Layers v3 파일럿 검토 기록

- Asset set: `pixel-layers-v3`
- Manifest phase: `pilot`
- Review status: `pending`
- 자동 점검일: 2026-08-31
- 사용자 검토자 / 승인일: 서비스 운영자 / 2026-08-31
- 원본 파츠팩: `public/avatar-parts/vendor/universal-lpc/`
- 전체 미리보기: `specs/005-rebuild-avatar-parts/validation/pilot-contact-sheet.png`

운영 참가자 화면은 계속 `v2`를 사용한다. 이 기록의 사전 점검은 구현자가 파츠 경계와 화면 배치를 확인한 결과이며, 사용자 승인을 대신하지 않는다.

## 검토 이력

- Revision 1: 기존 캐릭터와 너무 다른 단순한 레트로 스타일이라 반려.
- Revision 2: 기존 `high-density-atlas-v2`의 큰 머리, 풍성한 머리카락, 현대적인 의상과 긴 실루엣을 유지하도록 재구성.
- Revision 2 피드백: 머리 분할 이음새와 큰 사각형 눈이 어색하고, 기존 아이템에서 손만 제거한 흔적이 저품질로 보임.
- Revision 3: 머리카락을 앞뒤로 자르지 않고 기존 고밀도 원본 전체를 유지. 눈을 더 작고 둥근 픽셀 클러스터로 수정.
- 아이템 정책 변경: 기존 아이템 편집본을 폐기하고 러버덕, 브라우저 탭, USB, 테스트 체크를 손 없는 투명 오브젝트로 새로 생성. 캐릭터 오른쪽 아래에 독립적으로 표시.
- Revision 3 사용자 결정: 캐릭터 파츠를 계속 새로 생성하면 토큰 낭비가 크므로 통일된 기존 에셋팩을 사용하기로 결정.
- Revision 4: CC0 `32x32 Customizable Character Pack`의 정면 대기 모션에서 몸, 눈, 머리, 상의, 하의와 신발을 선택. 모든 캐릭터 파츠는 원본부터 같은 격자이며 AI로 다시 그리지 않음.
- Revision 4 아이템: 기존 손 없는 프로젝트 아이템 4종만 크기를 줄여 캐릭터 오른쪽 아래에 유지.
- Revision 4 사용자 결정: 시각 확인 대기 중.
- Revision 5: 무료 Universal LPC 파츠를 선택. 64×64 공통 격자의 몸, 머리, 눈, 머리카락,
  상의, 바지와 신발을 조합하고 파츠별 색상 팔레트를 적용해 대표 4개를 다시 생성.
- Revision 5 사용자 결정: LPC의 많은 variant와 기존 해시를 나눠 써서 캐릭터 중복을 줄이는
  방향에 동의. 네 대표 조합과 Universal LPC 화풍을 모두 승인함.

## 자동 검사

| 검사 | 결과 | 근거 |
|---|---|---|
| manifest/schema, 파일 존재, SHA-256 | PASS | `npm run avatar:assets:validate` |
| 256×384 RGBA, hard alpha, safe bounds | PASS | `npm run avatar:assets:validate` |
| hair/item 얼굴 마스크 침범 | PASS, 0건 | `npm run avatar:assets:validate` |
| item 몸통 가림 30% 초과 | PASS, 0건 | `npm run avatar:assets:validate` |
| canonical 화면 키 | PASS, 2,160개 고유 | `tests/unit/avatar-assets.test.ts` |
| 기존 배정값 | PASS, 1,200개 불변 | `tests/unit/avatar-assignment-regression.test.ts` |
| 360px 가로 넘침 | PASS | `tests/e2e/avatar-visual.spec.ts` |
| 192/76/52/80/48px 렌더 | PASS, 4개×5문맥 | `tests/e2e/avatar-visual.spec.ts` |
| 관리자 세션 없는 접근 | PASS, 로그인으로 이동 | `tests/e2e/avatar-visual.spec.ts` |

## 대표 조합 사전 검토

`PASS`는 구현자의 사전 시각 점검 결과다. 아래 네 행 모두 사용자 확인을 받아야 최종 승인으로 바뀐다.

| Case | 얼굴 | 파츠 중복 | 아이템 식별 | 몸통 가림 | 기준선 | 잘림 | 선명도 | 사용자 결정 | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| `short-small-item` | PASS | PASS | PASS, duck | PASS | PASS | PASS | PASS | APPROVED | `tests/e2e/avatar-visual.spec.ts-snapshots/pilot-short-small-item-mobile-chrome-win32.png` |
| `long-wide-item` | PASS | PASS | PASS, browser-tabs | PASS | PASS | PASS | PASS | APPROVED | `tests/e2e/avatar-visual.spec.ts-snapshots/pilot-long-wide-item-mobile-chrome-win32.png` |
| `cap-tiny-item` | PASS | PASS | PASS, usb | PASS | PASS | PASS | PASS | APPROVED | `tests/e2e/avatar-visual.spec.ts-snapshots/pilot-cap-tiny-item-mobile-chrome-win32.png` |
| `tall-large-item` | PASS | PASS | PASS, test-check | PASS | PASS | PASS | PASS | APPROVED | `tests/e2e/avatar-visual.spec.ts-snapshots/pilot-tall-large-item-mobile-chrome-win32.png` |

## 실행 결과

- ESLint: 오류 0건
- TypeScript: 통과
- Unit: 16 files, 73 tests 통과
- Production build: 통과, `/admin/avatar-review` 동적 경로 포함
- Playwright pilot: 2 tests 통과

## 사용자 메모

Universal LPC의 64×64 인물 비율과 파츠 조합을 파일럿 기준으로 승인했다. 다음 구간에서는
저장된 프로필 값을 바꾸지 않고 기존 해시를 시각 파츠별로 나눠 더 많은 variant를 고른다.
