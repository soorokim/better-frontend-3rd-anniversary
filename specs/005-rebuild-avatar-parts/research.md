# Research: 모듈형 픽셀 아바타 재구성

## 현재 문제 확인

현재 `v2` 파일은 모두 256×384지만 같은 크기라는 것만으로 같은 골격을 공유하지 않는다.
`PixelAvatar`는 body, SVG face, hair, outfit, item을 전체 캔버스 배경으로 그대로 겹치며,
파츠별 anchor나 가림 영역 계약이 없다. 실제 PNG에는 outfit의 손·신발과 item의 손이 섞여
있다. 아이템의 몸통 침범률은 약 57~97%로 명세의 30% 기준을 모두 넘는다.

`extract_avatar_atlas.py`는 크로마 제거 뒤 LANCZOS로 크기를 바꾸면서 수천 개의 부분 alpha
픽셀을 만든다. 사용자가 본 흐린 가장자리는 원본 해상도 부족보다는 이 보간과 정사각형
표시 크기에서 생기는 소수점 배율의 영향이 더 크다.

## Decision 1: 참가자 배정은 동결하고 시각 에셋만 버전 관리

**Decision**: `pixel-parts-v1`, `avatar-generator-v1`, 카탈로그 ID와 순서, 저장된 traits,
프로필 해시·클래스·상태·아이템을 바꾸지 않는다. 새 버전은 `pixel-layers-v3`라는
presentation-only asset set으로 둔다.

**Rationale**: 카탈로그 버전이 생성기 해시 namespace에 포함되어 있어 올리면 기존 참가자의
조합이 달라진다. 이번 요구는 정체성 재배정이 아니라 보이는 품질 수정이다.

**Alternatives considered**:

- 카탈로그 v2와 DB migration: 기존 참가자 조합이 바뀌므로 제외했다.
- 각 참가자에게 완성 이미지를 새로 저장: 조합성과 재현성을 잃고 운영 데이터가 늘어나 제외했다.

## Decision 2: 공통 논리 격자와 역할별 소유권 사용

**Decision**: 파츠는 128×192 논리 격자에서 만든 뒤 nearest-neighbor로 256×384에 정확히
2배 출력한다. 모든 파일은 최종 좌표의 전체 캔버스이며 런타임 offset을 두지 않는다.
레이어는 `hairBack → body → outfit → faceFeatures → hairFront → item → accent` 순서다.

**Rationale**: 긴 머리는 몸 뒤와 얼굴 앞이 모두 필요하지만 완성된 머리 한 장을 얼굴 위에
올리면 얼굴이 가려진다. 한 hair ID가 back/front 두 파일을 소유하면 ID를 늘리지 않고 이
문제를 풀 수 있다. 런타임 보정보다 파일 자체가 같은 기준에 맞는 편이 화면 간 오차도 적다.

**Alternatives considered**:

- 머리 PNG 한 장을 항상 맨 위에 표시: 긴 머리와 얼굴 안전 영역을 동시에 다루기 어렵다.
- 파츠마다 CSS 좌표와 배율 지정: 화면 크기마다 오차가 누적되고 검토가 어려워 제외했다.
- 완성 캐릭터 16종만 사용: 사용자가 원한 조합형 다양성을 잃어 제외했다.

## Decision 3: 생성 이미지는 원본 후보로만 쓰고 격자 정규화 뒤 런타임에 넣기

**Decision**: 이미지 생성 도구나 외부 에셋을 시각 참고와 원본 후보로 활용할 수 있지만,
런타임에는 공통 골격 위에서 역할별로 정리하고 hard alpha와 논리 격자를 통과한 파일만
넣는다. 프롬프트, 원본, 수정 방식과 라이선스 근거를 함께 기록한다.

**Rationale**: 생성 이미지 한 장에서 자동으로 잘라낸 현재 방식은 파츠마다 다른 손과 비율을
남겼다. 생성 단계의 분위기는 활용하되 정확한 경계와 위치는 별도 검수해야 한다.

**Alternatives considered**:

- 생성 atlas를 자동 crop해 바로 사용: 현재 실패를 반복할 가능성이 높다.
- 출처가 불분명한 기존 게임 에셋 사용: 배포 조건과 스타일 결합 문제가 있어 제외했다.

## Decision 4: manifest를 유일한 에셋 계약으로 사용

**Decision**: 정적 JSON manifest가 캔버스, 안전 영역, 레이어 순서, 파츠 파일, 별칭,
fallback, 파일럿 조합, 출처와 승인 상태를 모두 정의한다. 앱은 Zod로 읽고 검증 스크립트는
JSON Schema와 실제 PNG를 대조한다.

**Rationale**: 현재 경로와 매핑이 컴포넌트 여러 상수에 흩어져 있고 문서도 런타임 PNG 사용
여부를 서로 다르게 설명한다. 한 계약을 코드, 검토 화면과 테스트가 같이 써야 어긋남을 잡을
수 있다.

**Alternatives considered**:

- TypeScript 상수만 유지: 사람이 읽기는 쉽지만 에셋 제작·검증 도구와 공유하기 어렵다.
- DB에 에셋 상태 저장: 한 번 승인해 배포하는 정적 행사 에셋에 비해 지나치게 크다.

## Decision 5: 네 개 파일럿을 승인하기 전 운영 렌더러를 바꾸지 않기

**Decision**: manifest의 `phase=pilot`은 관리자 전용 `/admin/avatar-review`에서만 보인다.
대표 4개는 짧은/긴/높은 머리, 네 의상, 세 피부색, 작은/넓은/큰 아이템을 포함한다.
모든 실제 크기에서 승인 기록을 남긴 뒤 전체 파츠를 만든다.

**Rationale**: 현재처럼 전체 atlas를 먼저 만들고 나중에 비율 문제를 찾으면 모든 파츠를
다시 손봐야 한다. 운영 `v2`를 유지하면 파일럿이 불완전해도 참가자에게 영향이 없다.

**Alternatives considered**:

- 후보를 바로 운영에 배포: 아직 없는 파츠가 fallback으로 바뀌어 참가자 경험을 해친다.
- 웹에서 승인값을 DB에 저장: 별도 API, 권한, migration이 필요하지만 행사 전 제작 승인에는 필요 없다.

## Decision 6: fallback을 먼저 그리고 성공한 조합만 원자적으로 공개

**Decision**: 완성된 단일 `fallback-default.png`를 SSR에서 먼저 표시한다. 필요한 `<img>`
레이어를 모두 preload한 뒤 성공하면 한 번에 조합으로 전환한다. 하나라도 실패하면 fallback을
유지하고 관리자에게만 실패 role과 part ID를 보여준다.

**Rationale**: 현재 CSS background는 로드 실패를 감지할 수 없어 몸이나 머리만 없는 조합이
남는다. 파츠별 fallback 역시 서로 다른 캐릭터 조각을 섞는 결과가 된다.

**Alternatives considered**:

- 실패한 레이어만 숨김: 부분 캐릭터 노출을 막지 못한다.
- 오류를 서버 DB로 전송: 민감정보 위험과 운영 복잡성에 비해 이 기능에는 필요 없다.

## Decision 7: 저장 조합과 화면 조합을 따로 전수 검사

**Decision**: 기존 생성기 회귀는 3×5×4×5×4=1,200개 저장 조합을 검사한다. 시각 검사는
`terminal→laptop`, `book→error-log` 별칭을 정규화하고 `none + 대화 아이템 8종`을 합친
9개 고유 item으로 3×5×4×9×4=2,160개 화면 조합을 검사한다.

**Rationale**: 기존 문서의 1,200개만 화면 범위로 보면 대화 전용 장비 여러 개가 빠진다.
반대로 alias까지 별도 화면으로 세면 같은 파일을 불필요하게 중복 검사한다.

**Alternatives considered**:

- 대표 조합 스크린샷만 검사: 누락된 ID와 alias 오류를 찾을 수 없다.
- 2,160개 전체를 사람이 직접 검토: 반복이 너무 많고 누락 가능성이 높다.

## Decision 8: 정적 검사, 브라우저 검사와 사람 판단을 나누기

**Decision**: `sharp`를 직접 개발 의존성으로 선언한 Node 스크립트가 PNG 크기, RGBA,
hard alpha, bounds, face mask 교차 0, torso mask 교차 30% 이하와 checksum을 검사한다.
Vitest는 manifest와 배정 불변성을, Playwright는 실제 크기·fallback·화면 간 동일성을,
운영자는 손·발 중복과 아이템 식별을 확인한다.

**Rationale**: 신체 의미는 픽셀 색만으로 믿을 만하게 추론하기 어렵다. 반대로 파일 누락과
마스크 교차는 사람이 수천 조합을 보는 것보다 자동 검사가 정확하다.

**Alternatives considered**:

- 전체 페이지 golden screenshot: 폰트와 주변 레이아웃 변화에 취약하다.
- 브라우저 Canvas만으로 모든 정적 검사: 실행 중 서버가 필요해 build 전 실패를 빠르게 잡기 어렵다.

## Decision 9: 새 API와 DB migration을 만들지 않기

**Decision**: 관리자 검토는 기존 관리자 세션을 사용하는 HTML 페이지로 제공한다. 승인 상태와
실패 메모는 `validation/pilot-review.md`와 manifest에 커밋한다. 참가자/API 응답 형식은 그대로다.

**Rationale**: 승인은 운영 중 반복되는 비즈니스 상태가 아니라 새 에셋 묶음의 배포 전 품질
게이트다. 저장소 기록이면 검토한 파일 버전과 함께 남고 복구도 단순하다.

**Alternatives considered**:

- 승인용 API와 테이블: 현재 범위를 넘어선다.
- 공개 `/avatar-lab`만 사용: production flag가 켜지면 인증 없이 열릴 수 있어 관리자 검토에 부적합하다.

