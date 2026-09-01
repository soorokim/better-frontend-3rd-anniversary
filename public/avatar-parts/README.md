# Legacy avatar-part assets

현재 참가자 아바타는 PNG 레이어 조합이 아니라 DiceBear `Open Peeps`에 `Bold Pop`
프리셋을 적용해 서버에서 생성한 SVG를 사용한다. 렌더러는
`lib/avatar/dicebear.ts`, 화면 컴포넌트는 `components/avatar/PixelAvatar.tsx`에 있다.

기존 `v2/`, `v3/`, `vendor/` 폴더는 DB 특성 ID와 과거 검토 기록을 보존하기 위한
레거시 파일이다. 새 런타임 이미지를 추가하지 않는다.

현재 표시하는 개발자 아이템은 이 폴더가 아니라
`public/avatar-items/bold-pop/`의 투명 32×32 SVG 8종이다. 아이템 ID는 기존 카탈로그와
호환되며, 참가자별 `developerHash`는 DiceBear seed로 그대로 전달된다.
