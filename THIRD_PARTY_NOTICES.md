# Third-party notices

이 문서는 화면에 쓰이는 픽셀 파츠, 폰트, 아이콘 파일을 점검한 결과다. npm 패키지의
라이선스 목록을 대신하는 문서는 아니다.

## 아바타

참가자 아바타는 설치된 DiceBear 패키지로 서버 안에서 생성한다. 외부 아바타 API를 호출하지 않는다.

- DiceBear Core: MIT License, https://github.com/dicebear/dicebear
- DiceBear Open Peeps: CC0 1.0, https://www.dicebear.com/styles/open-peeps/
- Open Peeps 원작: Pablo Stanley, CC0 1.0, https://www.openpeeps.com/

`Bold Pop`은 Open Peeps에 적용하는 옵션 프리셋이며, 강한 채도의 배경 팔레트만 고정한다. 머리·표정·의상 등의 구성은 참가자별 seed로 결정된다.

개발자 아이템 8종은 `public/avatar-items/bold-pop/`에 있는 이 프로젝트의 로컬 SVG다. 외부 아이콘 파일을 복사하지 않았으며, Open Peeps의 굵은 검은 선과 채색 방식에 맞춰 제작했다.

## 폰트

저장소에는 폰트 파일, 웹폰트 URL, `@font-face` 선언이 없다. `app/globals.css`에는
`Pretendard`, `Noto Sans KR`, `system-ui`, `sans-serif`가 시스템 폰트 대체 목록으로만
적혀 있다. 방문자의 기기에 앞의 폰트가 없으면 브라우저 시스템 글꼴을 사용한다. 이
서비스가 Pretendard나 Noto Sans KR 파일을 복제하거나 배포하지 않으므로 폰트 바이너리
라이선스 문구를 함께 배포할 대상도 현재는 없다.

나중에 웹폰트 파일이나 CDN 로딩을 추가하면 해당 버전의 원 출처와 라이선스 파일을 이
문서에 추가해야 한다.

## 아이콘과 파비콘

외부 아이콘 라이브러리나 아이콘 폰트를 사용하지 않는다. `public/favicon.svg`는 기본 SVG
도형으로 구성된 저장소 로컬 파일이며 초기 프로젝트 스캐폴드에서 함께 추가됐다. 외부
파일을 복사했다는 출처나 별도 라이선스 표시는 저장소 기록에 없다. 이 파일에는 별도의
제3자 저작물 고지를 적용하지 않는다.
