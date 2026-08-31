# Avatar Rendering and Review Contract

## 범위

이 기능은 참가자/API 응답과 DB 구조를 바꾸지 않는다. 아래 계약은 기존 `PixelAvatar`를
사용하는 참가자 로비, 관리자 목록, 진행자 컨트롤러와 발표 화면이 같은 조합을 그리는 방법,
그리고 운영자가 후보 에셋을 검토하는 HTML 화면을 정의한다.

## PixelAvatar 입력 호환성

기존 공개 입력을 유지한다.

```text
nickname: string
traits: Record<string, string>
size?: number
```

- `traits`는 기존 body, hair, outfit, accessory, accent와 선택적인 `developerItem`을 받는다.
- `developerItem`이 알려진 대화 장비면 accessory보다 우선한다.
- 알 수 없는 값은 기존 정규화 기본값으로 해석하되, 필요한 manifest 파일이 없으면 완성된 fallback을 사용한다.
- `nickname`은 접근 가능한 이미지 설명에만 쓰고 에셋 경로나 진단 식별자에 넣지 않는다.

## 출력 DOM 계약

최상위 이미지 요소는 다음을 제공한다.

| 속성 | 값 |
|---|---|
| `role` | `img` |
| `aria-label` | 닉네임과 확정 프로필을 설명하는 기존 문구 |
| `data-avatar-combination` | canonical `body:hair:outfit:item:accent` |
| `data-avatar-asset-set` | manifest의 `assetSetVersion` |
| `data-avatar-render-state` | `loading`, `ready`, `fallback` |
| `data-avatar-failed-part` | 관리자/검토 화면의 fallback일 때만 `role:id`; 참가자 화면에서는 생략 |

레이어 이미지는 장식이므로 보조기술 트리에서 숨긴다. 모든 레이어는 manifest의 같은
256×384 view box를 사용하며 개별 CSS 이동/확대를 적용하지 않는다.

## 원자적 표시

1. 서버가 완성된 fallback과 `loading` 상태를 렌더한다.
2. 브라우저가 조합에 필요한 모든 레이어를 preload한다.
3. 전부 성공하면 한 렌더에서 `ready` 조합으로 교체한다.
4. 하나라도 실패하거나 제한 시간 안에 준비되지 않으면 `fallback`을 유지한다.
5. 일부 성공 레이어와 fallback 또는 일부 조합 레이어를 섞지 않는다.

## 크기 계약

동일한 컴포넌트가 현재 사용되는 다음 문맥에서 같은 `data-avatar-combination`을 제공해야 한다.

| 문맥 | 검증 크기 |
|---|---:|
| 참가자 로비 | 192px |
| 관리자 참가자 목록 | 76px |
| 진행자 답변 목록 | 48px |
| 진행자 컨트롤러 | 52px |
| 발표 화면 | 80px |

360px viewport에서 로비 카드가 가로 스크롤을 만들지 않아야 한다. 모든 문맥에서 전신이
잘리지 않아야 한다. 장비의 이름 없는 식별 판정은 192px 로비 크기에서 하고, 작은 운영
문맥은 조합 동일성·정렬·잘림·픽셀 선명도를 판정한다.

## 관리자 검토 화면

`GET /admin/avatar-review`는 기존 관리자 세션을 요구하는 HTML 화면이다. 새 JSON API는 없다.

- `mode=pilot`: manifest의 대표 4개를 모든 실제 표시 크기로 보여 준다.
- `mode=parts`: body, hair, outfit, item을 역할별로 분리해 확인한다.
- `mode=all`: canonical 2,160개 조합을 필터·페이지 단위로 보여 주고 생성된 contact sheet 경로를 안내한다.
- 화면은 asset set version, phase, combination ID, fallback 여부와 실패 role/ID를 보여 준다.
- 승인 버튼이나 DB 쓰기는 없다. 실제 결과는 저장소의 `validation/pilot-review.md`에 기록한다.

관리자 세션이 없으면 기존 관리자 로그인으로 이동한다. production에서 후보 manifest를 참가자
화면에 선택하는 query parameter나 공개 환경 변수는 제공하지 않는다.

## 호환 경계

- `/avatars/pixel-art`의 URL, seed, DiceBear 출력과 cache contract는 변경하지 않는다.
- 가입, 로그인, `/api/me`, 관리자 참가자와 발표 API 응답은 변경하지 않는다.
- 기존 `AvatarReveal`, 관리자 목록과 진행자 컴포넌트는 `PixelAvatar` props를 바꾸지 않고 새 렌더러를 사용한다.

