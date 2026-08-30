# Pixel parts v1

첫 MVP의 `pixel-parts-v1` 카탈로그는 다음과 같은 안정된 ID만 공개한다.

- body: `light`, `warm`, `deep`
- hair: `short`, `wave`, `bob`, `spike`, `cap`
- outfit: `hoodie`, `sweater`, `jacket`, `overalls`
- accessory: `none`, `terminal`, `keyboard`, `coffee`, `book`
- accent: `yellow`, `pink`, `mint`, `sky`

ID의 순서나 의미를 바꾸면 기존 캐릭터가 달라지므로 새 카탈로그 버전을 만든다.

## 구현과 출처

- 파츠 선택과 안정된 ID는 이 프로젝트의 자체 코드다. 기존 DB 값은 바꾸지 않는다.
- `lib/avatar/dicebear.ts`가 이 조합을 고정 seed와 DiceBear 옵션으로 바꿔 Pixel Art SVG를
  만든다. SVG는 `/avatars/pixel-art`에서 같은 출력을 장기 캐시한다.
- 터미널·키보드·커피·책은 `PixelAvatar` 컴포넌트가 자체 배지로 표시한다.
- DiceBear Core는 MIT, Pixel Art 스타일은 CC0 1.0이다. 자세한 고지는 저장소 루트의
  `THIRD_PARTY_NOTICES.md`에 적어 둔다.

폰트와 파비콘을 포함한 UI 에셋 점검 결과는 저장소 루트의
`THIRD_PARTY_NOTICES.md`에 적어 둔다.
