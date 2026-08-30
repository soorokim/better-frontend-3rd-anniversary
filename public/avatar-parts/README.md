# Pixel parts v1

첫 MVP의 캐릭터는 외부 이미지 파일이 아니라 `PixelAvatar` 컴포넌트의 CSS 도형으로
그린다. `pixel-parts-v1` 카탈로그는 다음과 같은 안정된 ID만 공개한다.

- body: `light`, `warm`, `deep`
- hair: `short`, `wave`, `bob`, `spike`, `cap`
- outfit: `hoodie`, `sweater`, `jacket`, `overalls`
- accessory: `none`, `terminal`, `keyboard`, `coffee`, `book`
- accent: `yellow`, `pink`, `mint`, `sky`

ID의 순서나 의미를 바꾸면 기존 캐릭터가 달라지므로 새 카탈로그 버전을 만든다.

## 구현과 출처

- 실제 화면은 `components/avatar/PixelAvatar.tsx`의 HTML `span`과 CSS 색상·그림자로
  그린다. 이 디렉터리에서 런타임에 읽는 PNG, SVG, 스프라이트 시트는 없다.
- 파츠 이름, 도형, 색상은 이 프로젝트의 첫 구현을 위해 작성한 자체 코드다. 외부 게임,
  캐릭터 생성기, 아이콘 모음에서 가져온 이미지 파츠는 없다.
- 따라서 픽셀 파츠에 따로 적용되는 제3자 에셋 라이선스나 출처 표시는 없다. 코드는
  저장소 자체의 이용 조건을 따른다.

폰트와 파비콘을 포함한 UI 에셋 점검 결과는 저장소 루트의
`THIRD_PARTY_NOTICES.md`에 적어 둔다.
