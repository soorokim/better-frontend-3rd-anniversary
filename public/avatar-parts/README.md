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
- 참가자 화면에는 `full-body-developers-v1.png`의 4×4 전신 스프라이트 아틀라스를 쓴다.
  개발자 아이템과 표시 해시로 셀 하나를 고르므로 재접속해도 같은 캐릭터가 보인다.
- 이 전신 아틀라스는 2026-08-31에 이 프로젝트를 위해 OpenAI 이미지 생성 도구로 만든
  원본 에셋이다. 제3자 게임 에셋을 복사하거나 합성하지 않았다. 생성 프롬프트는
  `full-body-developers-v1.prompt.md`에 함께 보관한다.
- `lib/avatar/dicebear.ts`가 이 조합을 고정 seed와 DiceBear 옵션으로 바꿔 Pixel Art SVG를
  만든다. SVG는 기존 API 호환을 위해 `/avatars/pixel-art`에서 같은 출력을 장기 캐시한다.
- DiceBear Core는 MIT, Pixel Art 스타일은 CC0 1.0이다. 자세한 고지는 저장소 루트의
  `THIRD_PARTY_NOTICES.md`에 적어 둔다.

폰트와 파비콘을 포함한 UI 에셋 점검 결과는 저장소 루트의
`THIRD_PARTY_NOTICES.md`에 적어 둔다.
