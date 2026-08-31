# Pixel parts v1

첫 MVP의 `pixel-parts-v1` 카탈로그는 다음과 같은 안정된 ID만 공개한다.

- body: `light`, `warm`, `deep`
- hair: `short`, `wave`, `bob`, `spike`, `cap`
- outfit: `hoodie`, `sweater`, `jacket`, `overalls`
- accessory: `none`, `terminal`, `keyboard`, `coffee`, `book`
- accent: `yellow`, `pink`, `mint`, `sky`

ID의 순서나 의미를 바꾸면 기존 캐릭터가 달라지므로 새 카탈로그 버전을 만든다.

이 조합은 현재 `3 × 5 × 4 × 5 × 4 = 1,200`가지다.

## 구현과 출처

- 파츠 선택과 안정된 ID는 이 프로젝트의 자체 코드다. 기존 DB 값은 바꾸지 않는다.
- 참가자 화면은 `components/avatar/PixelAvatar.tsx`의 동일한 48×58 격자 위에 몸, 머리,
  옷, 소지품, 강조 효과를 차례로 겹친다. 대화 프로필에서 정한 8개 장비도 각각 별도
  레이어로 표현한다. 16개 완성 캐릭터 중 하나를 고르는 방식이
  아니므로 카탈로그의 1,200가지 조합이 모두 서로 다른 레이어 조합으로 표현된다.
- 모든 런타임 파츠는 이 프로젝트를 위해 만든 SVG 픽셀 도형이다. 제3자 게임 에셋을
  복사하거나 합성하지 않았다.
- `layered-parts-concept-v1.png`는 파츠의 분위기를 잡을 때 OpenAI 이미지 생성 도구로 만든
  프로젝트 전용 콘셉트 시트다. 런타임에서 자르거나 표시하지 않으며 생성 프롬프트는
  `layered-parts-concept-v1.prompt.md`에 보관한다.
- 이전 `full-body-developers-v1.png`는 v1 기록과 비교를 위해 남아 있지만 런타임에서는
  더 이상 사용하지 않는다.
- `lib/avatar/dicebear.ts`가 이 조합을 고정 seed와 DiceBear 옵션으로 바꿔 Pixel Art SVG를
  만든다. SVG는 기존 API 호환을 위해 `/avatars/pixel-art`에서 같은 출력을 장기 캐시한다.
- DiceBear Core는 MIT, Pixel Art 스타일은 CC0 1.0이다. 자세한 고지는 저장소 루트의
  `THIRD_PARTY_NOTICES.md`에 적어 둔다.

폰트와 파비콘을 포함한 UI 에셋 점검 결과는 저장소 루트의
`THIRD_PARTY_NOTICES.md`에 적어 둔다.
