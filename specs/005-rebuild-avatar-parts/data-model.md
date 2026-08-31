# Data Model: 모듈형 픽셀 아바타 재구성

## 모델링 기준

이 기능은 PostgreSQL 스키마를 바꾸지 않는다. `AvatarAssignment`와 대화 프로필에 저장된
catalog version, generator version, traits, 해시, 클래스, 상태와 아이템을 그대로 둔다.
아래 모델은 Git으로 버전 관리하는 정적 asset manifest와 승인 기록이다.

## AvatarAssetManifest

하나의 배포 가능한 시각 에셋 세트와 검증 기준을 나타낸다.

| 필드 | 형식 | 규칙 |
|---|---|---|
| `schemaVersion` | string | `avatar-asset-manifest-v1` |
| `assetSetVersion` | string | `pixel-layers-v3`처럼 기존 값과 중복되지 않는 시각 버전 |
| `phase` | enum | `pilot`, `approved`, `retired` |
| `catalogVersion` | string | 기존 `pixel-parts-v1`과 일치 |
| `canvas` | CanvasContract | 모든 파일이 공유하는 좌표와 안전 영역 |
| `layerOrder` | string[] | 허용된 역할을 중복 없이 렌더 순서로 나열 |
| `fallback` | FallbackAsset | 완성된 기본 캐릭터 한 장 |
| `parts` | PartRegistry | body, hair, outfit, item의 ID별 파일 |
| `aliases` | AliasRegistry | 저장 ID와 대화 아이템 이름을 canonical 시각 ID로 변환 |
| `pilotCases` | PilotCase[4] | 전체 확장 전 검토하는 정확히 네 조합 |
| `provenance` | ProvenanceRecord[] | 모든 파일의 출처와 재배포 조건 |
| `review` | ReviewSummary | 파일럿/전체 승인 상태와 기록 경로 |

검증 규칙:

- `assetSetVersion`은 파일 경로 namespace와 일치한다.
- active renderer가 참조하는 manifest는 `phase=approved`, `review.status=approved`여야 한다.
- `phase=pilot`은 관리자 검토 화면에서만 선택할 수 있다.
- 모든 part와 fallback은 존재하는 provenance ID를 참조한다.
- `redistributionAllowed=false`인 provenance를 참조한 파일은 승인할 수 없다.

상태 전이:

```text
pilot ──대표 4개 승인 + 전체 파츠 완성 + 전수검사──> approved
approved ──새 승인 세트 활성화──> retired
```

실패한 pilot은 상태를 바꾸지 않고 같은 `assetSetVersion` 안에서 파일과 검토 기록을 갱신한다.
운영에 한 번 활성화한 파일 내용을 바꾸지 않는다. 수정이 필요하면 새 버전을 만든다.

## CanvasContract

| 필드 | 형식 | 규칙 |
|---|---|---|
| `width`, `height` | integer | 각각 256, 384 |
| `logicalWidth`, `logicalHeight` | integer | 각각 128, 192 |
| `exportScale` | integer | 2 |
| `pixelInterpolation` | enum | `nearest` |
| `safeBounds` | Rect | 모든 보이는 픽셀이 들어가는 범위 |
| `baselineY` | integer | 모든 캐릭터가 공유하는 발밑 기준선 |
| `faceSafeArea` | Rect | hairFront와 item alpha가 침범할 수 없는 영역 |
| `torsoArea` | Rect | item 가림 비율을 계산하는 영역 |
| `anchors` | object | 왼손, 오른손, 왼쪽/오른쪽 지면 아이템의 기준점 |

좌표는 최종 256×384 캔버스 기준 정수다. 파일럿 중에는 실제 눈 위치에 맞게 조정할 수 있지만
네 조합 승인 뒤에는 같은 asset set 안에서 바꾸지 않는다.

## AvatarPart

하나의 안정된 카탈로그 ID를 화면 파일에 연결한다.

| 필드 | 형식 | 규칙 |
|---|---|---|
| `id` | string | 기존 카탈로그 또는 canonical item ID |
| `role` | enum | `body`, `hair`, `outfit`, `item` |
| `layers` | object | 허용된 layer role과 PNG 경로·SHA-256. `none` item은 비어 있을 수 있음 |
| `contentBounds` | Rect nullable | 보이는 alpha의 예상 경계. `none`만 null |
| `anchor` | string nullable | item처럼 기준점이 필요한 역할에 사용 |
| `provenanceId` | string | 출처 레코드 참조 |
| `variants` | VisualVariant[] optional | 같은 저장 ID 안에서 시각 seed로 고르는 추가 LPC 파츠 |

역할 소유권:

- `body`: 피부, 얼굴 바탕, 손, 발과 기본 신체만 포함한다.
- `hair`: 머리카락과 머리 장식만 포함한다. 같은 ID가 back/front 두 파일을 가질 수 있다.
- `outfit`: 의상만 포함한다. 피부, 손, 발과 얼굴을 포함하지 않는다.
- `item`: 물체만 포함한다. 손과 신체를 포함하지 않는다.

모든 PNG는 256×384 RGBA, hard alpha(0 또는 255), safe bounds 안의 content를 가져야 한다.

## AliasRegistry

저장값을 바꾸지 않고 실제 시각 파일을 고르는 관계다.

### accessory

| 입력 ID | canonical item ID |
|---|---|
| `none` | `none` |
| `terminal` | `laptop` |
| `keyboard` | `keyboard` |
| `coffee` | `coffee` |
| `book` | `error-log` |

### developerItem

`RUBBER DUCK`, `COFFEE`, `MECHANICAL KEYBOARD`, `LAPTOP`, `RED ERROR LOG`,
`GREEN TEST CHECK`, `ENDLESS BROWSER TABS`, `UNKNOWN USB`를 각각 8개의 canonical item ID에
연결한다. `developerItem`이 있으면 현재 동작처럼 accessory보다 우선한다.

## ResolvedAvatarComposition

런타임에 저장하지 않는 최종 화면 해석 결과다.

| 필드 | 형식 | 규칙 |
|---|---|---|
| `assetSetVersion` | string | 현재 승인된 시각 에셋 버전 |
| `combinationId` | string | body:hair:outfit:item:accent canonical 키 |
| `bodyId`, `hairId`, `outfitId`, `itemId`, `accentId` | string | 정규화된 안정 ID |
| `layers` | LayerAsset[] | manifest `layerOrder`에 따른 실제 파일 목록 |

`combinationId`는 기존 저장 traits만으로 만들고 바꾸지 않는다. 실제 파일은 대화 기반
`developerHash`가 있으면 그 값을, 없으면 닉네임을 시각 seed로 사용해 body, hair, outfit
variant를 각각 고른다. 같은 seed와 manifest는 언제나 같은 파일 목록을 만들며 seed 원문은
DOM이나 로그에 노출하지 않는다.

## AvatarRenderState

브라우저 메모리에만 존재하며 DB나 API에 저장하지 않는다.

| 필드 | 형식 | 규칙 |
|---|---|---|
| `status` | enum | `loading`, `ready`, `fallback` |
| `assetSetVersion` | string | 시도한 에셋 버전 |
| `combinationId` | string | 원래 참가자 조합. fallback이 떠도 변경하지 않음 |
| `failed` | object nullable | `role`, `partId`, `reason`만 포함 |

상태 전이:

```text
SSR fallback/loading ──모든 레이어 로드 성공──> ready
       └──────── 알 수 없는 ID·누락·오류·시간 초과 ──> fallback
```

일부 레이어만 화면에 표시되는 중간 상태는 없다.

## PilotCase와 ReviewRecord

### PilotCase

| 필드 | 형식 | 규칙 |
|---|---|---|
| `id` | string | 검토 기록과 스냅샷에서 사용하는 안정 ID |
| `traits` | object | body, hair, outfit, accessory, accent |
| `developerItem` | string | 대화 아이템 override |
| `expectedItemId` | string | alias 적용 뒤 canonical item |
| `riskCoverage` | string[] | short/long/tall hair, wide/large/small item, mobile 등 |

네 조합은 세 body, 짧은·긴·높은 hair, 네 outfit, 네 accent를 포함한다.

### ReviewRecord

`specs/005-rebuild-avatar-parts/validation/pilot-review.md`에 사람 검토 결과를 남긴다.

| 필드 | 형식 | 규칙 |
|---|---|---|
| asset set version | string | 검토한 manifest와 일치 |
| reviewer / reviewed at | text/date | 실제 승인자와 날짜 |
| case | PilotCase ID | 네 항목이 정확히 한 번씩 존재 |
| surface | enum | mobile lobby, admin list, controller, presenter |
| criteria | pass/fail | 얼굴, 중복, 식별, 가림, 정렬, 잘림, 선명도 |
| notes | text | 실패 이유와 수정 내용. 참가자 개인정보 금지 |
| evidence | path | 요소 단위 스크린샷 또는 contact sheet |

네 case의 모든 surface와 기준이 pass일 때만 `review.status`를 `approved`로 바꿀 수 있다.

## ProvenanceRecord

| 필드 | 형식 | 규칙 |
|---|---|---|
| `id` | string | manifest 안에서 유일 |
| `sourceType` | enum | `project-generated`, `third-party` |
| `creatorOrTool` | string | 제작자 또는 사용 도구 |
| `createdAt` | date | 원본 생성일 |
| `sourceAsset` | path | 저장소 안 원본 또는 근거 파일 |
| `promptFile` | path nullable | 생성 도구를 썼을 때 프롬프트 기록 |
| `modifications` | string | 정규화, 수작업 수정과 추출 방식 |
| `licenseSpdx` | string | SPDX 식별자 또는 프로젝트 소유 표기 |
| `sourceUrl`, `licenseUrl` | URI nullable | 제3자 자료일 때 필수 |
| `redistributionAllowed` | boolean | false면 런타임 사용 불가 |
| `noticeFile` | path | `THIRD_PARTY_NOTICES.md` 또는 대응 고지 |
