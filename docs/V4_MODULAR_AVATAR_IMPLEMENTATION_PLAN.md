# V4 조합형 픽셀 아바타 구현 계획

**Status**: 재설계 전용 계획. 현재 V2/V4 혼합 파일럿은 이 계획의 입력 자산으로 사용하지 않는다.

## 왜 다시 만드는가

완성형 V4 골든 캐릭터는 목선과 비율의 좋은 기준이지만, 그 안의 그림을 사후 분리한 PNG는 조합형 파츠가 아니다. 반대로 V2는 이미 조합 가능한 좌표를 가졌지만, 일부 hair·outfit 파일이 얼굴이나 손을 함께 소유한다. 두 종류를 섞으면 소유권과 기준점이 겹쳐 어색해진다.

이번 구현의 목표는 V4 스타일로 보이는 **단일 출처의 모듈형 카탈로그**를 만드는 것이다. 랜덤 배정·표시 컴포넌트는 그 다음 문제다.

## 조사에서 가져온 원칙

- 랜덤 아바타는 seed에서 각 파츠 선택을 순서대로 계산하고 같은 seed에는 항상 같은 결과를 돌려준다. 이 원칙은 DiceBear의 seed 기반 조합 방식과 같다.
- 파츠는 같은 origin, canvas, animation frame을 공유해야 맞는다. LPC처럼 호환되는 자산 묶음은 이 공통 좌표계를 먼저 정해 둔다.
- render order는 파츠의 책임과 함께 고정한다. 화면에서 각 PNG를 따로 `contain`하거나 이동시켜 맞추지 않는다.
- 카탈로그가 바뀌면 기존 seed의 결과도 달라질 수 있으므로, 선택 테이블과 catalog version을 함께 고정한다.

## 1. 마스터 템플릿을 먼저 만든다

`public/avatar-parts/v4-authoring/template/`에 원본 편집용 템플릿을 둔다. 배포 PNG가 아니라 파츠를 만들 때 복제하는 기준 파일이다.

| 항목 | 규격 |
|---|---|
| 작업 캔버스 | 256×384 RGBA, 투명 배경 |
| 논리 그리드 | 2px 단위의 픽셀 그리드. 확대/축소는 nearest-neighbour만 허용 |
| origin | 캔버스 좌상단 `(0, 0)` |
| 중심선 | `x=128` |
| 지면선 | `y=370` |
| 얼굴 피처 영역 | `x=74..182`, `y=94..154` |
| 목선 영역 | `x=112..144`, `y=154..178` |
| 손 보호 영역 | 좌 `x=48..88, y=214..286`, 우 `x=168..208, y=214..286` |
| 아이템 금지 영역 | 얼굴·목선 전체와 손 보호 영역 |

템플릿에는 실제 픽셀 아트가 아닌 guide layer를 둔다.

- `guide/center-ground`
- `guide/face-safe`
- `guide/neck-opening`
- `guide/hands`
- `guide/outfit-safe`
- `guide/hair-front-allow`

guide layer는 배포 파일에 export하지 않는다.

## 2. 파츠 소유권을 고정한다

| 파츠 | 허용 픽셀 | 금지 픽셀 | 고정 z-index |
|---|---|---|---|
| `hair-back` | 머리 뒤, 귀 뒤, 어깨 뒤로 내려오는 머리카락 | 눈·코·입·피부·옷·손 | 10 |
| `body` | 피부, 머리 바탕, 귀, 목, 손, 발 | 머리카락·의상·아이템 | 20 |
| `outfit` | 옷, 소매, 하의, 신발 | 얼굴, 피부 목선, 손, 아이템 | 30 |
| `face` | 눈, 눈썹, 코, 입, 홍조 | 피부 바탕, 머리카락, 옷 | 40 |
| `hair-front` | 이마의 앞머리와 옆머리 | 눈·코·입을 덮는 픽셀, 피부·옷·손 | 50 |
| `item-badge` | 캐릭터 바깥의 하단 또는 측면 배지 | 캐릭터 본체 전체 | 60 |

`hair-front-allow`은 이마 위의 제한된 앞머리 영역만 허용한다. hair가 눈·입 위로 내려오게 하고 싶으면, 그 자체를 별도 표정/앞머리 호환 variant로 취급한다. 보통 hair 파츠에서 예외 처리하지 않는다.

## 3. 아트 제작 파이프라인

1. 골든 캐릭터의 비율과 팔레트를 참고해 새 **body master**를 템플릿 위에서 한 번 만든다. 이 파일이 모든 파츠의 실제 기준이 된다.
2. body master에서 `hair-back`, `body`, `outfit`, `face`, `hair-front`를 독립 레이어로 나눈 원본 편집 파일을 만든다. 이 한 세트가 기준 조합으로 정상이어야 한다.
3. 새 hair/outfit은 이 원본 파일을 복제한 뒤 자기 layer만 바꾼다. 완성 캐릭터 PNG를 잘라 쓰거나 다른 캐릭터에서 copy/paste하지 않는다.
4. export는 각 파츠를 동일한 256×384 canvas로 저장한다. visible content crop, 자동 trim, 개별 확대/축소를 금지한다.
5. 생성 도구를 쓸 경우에도 결과는 곧바로 runtime 자산이 되지 않는다. 템플릿 위의 role layer로 다시 정리하고 validator를 통과해야 한다.

초기 카탈로그는 작업량을 통제해 아래처럼 시작한다.

- body 3개: light / warm / deep
- hair-back + hair-front 5쌍: short, wave, bob, spike, ponytail
- outfit 4개: hoodie, sweater, jacket, overalls
- face 3개: body 톤과 대응하는 기본 표정
- item-badge 8개: 기존 대화 기반 아이템 의미를 보존하되 본체 밖에만 표시

## 4. manifest와 결정적 랜덤 배정

`v4-parts-v1.json`은 파츠 ID, 경로, checksum, role, source, bounds, catalog version만 가진다. CSS offset이나 파츠별 scale 값은 허용하지 않는다.

선택은 다음처럼 계산한다.

```text
roleHash = SHA-256("v4-parts-v1\0" + role + "\0" + avatarSeed)
partId = fixedBucketTable[role][roleHash[0..1]]
```

- `avatarSeed`는 기존 대화 프로필의 읽기 전용 값이다.
- body/hair/outfit/item은 각자 namespace hash를 쓴다.
- `fixedBucketTable`은 catalog version에 묶여 있어, 새 파츠를 추가해도 기존 `v4-parts-v1`의 결과가 바뀌지 않는다.
- catalog를 늘릴 때는 `v4-parts-v2`를 새로 만들고, 기존 참가자가 언제 새 버전으로 넘어갈지 별도 결정한다.

## 5. 자동 검증을 빌드의 일부로 만든다

`avatar:v4:validate`는 아래를 모두 검사한다.

1. 모든 PNG가 256×384이고 alpha가 `0 | 255`뿐인지
2. 각 파일의 checksum과 manifest가 맞는지
3. 파츠의 opaque pixel bounds가 해당 role의 허용 영역을 벗어나지 않는지
4. outfit이 목선·손 보호 영역을 침범하지 않는지
5. hair-front가 얼굴 피처 안전 영역을 침범하지 않는지
6. item badge가 본체 safe bounds와 겹치지 않는지
7. body × hair × outfit 전 조합이 빠짐없이 manifest에서 해석되는지
8. 누락 파일은 일부 파츠 출력이 아니라 완성형 golden fallback으로만 처리되는지

## 6. 전 조합 검토 매트릭스

`/avatar-lab/v4-matrix`에 아래 매트릭스를 만든다.

- 행: body × hair (15개)
- 열: outfit (4개)
- 셀: 실제 runtime 순서로 합성한 캐릭터
- 셀 아래: `body/hair/outfit` ID와 validator 상태
- 256px 대표 크기와 80px, 48px 축소 크기를 함께 제공

운영자는 이 화면에서 한 조합이라도 목선, 손, 눈, 발이 어색하면 해당 파츠를 reject한다. 파츠 하나를 수정하면 전 매트릭스 스냅샷을 다시 생성한다.

## 7. 완료 기준

- 기준 조합과 60개 전체 조합 모두 자동 검증을 통과한다.
- 360px 화면에서 매트릭스와 대표 카드가 가로 스크롤 없이 읽힌다.
- 같은 `avatarSeed`가 다시 접속해도 같은 part ID를 준다.
- V2 운영 렌더러는 V4 승인 전까지 변경하지 않는다.
- 운영자가 매트릭스 검토 결과를 승인해야만 다음 단계인 로비 적용을 시작한다.

## 지금 제거할 것

현재의 V2/V4 하이브리드 변환, hair의 사후 얼굴 마스킹, 골든 원본에서 잘라 만든 runtime 레이어는 이 계획에서 사용하지 않는다. 골든 원본은 style/proportion reference와 fallback으로만 남긴다.
