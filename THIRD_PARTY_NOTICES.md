# Third-party notices

이 문서는 화면에 쓰이는 픽셀 파츠, 폰트, 아이콘 파일을 점검한 결과다. npm 패키지의
라이선스 목록을 대신하는 문서는 아니다.

## 픽셀 캐릭터

아바타의 조합값은 `lib/avatar/catalog.ts`의 프로젝트 자체 카탈로그에서 만들고,
현재 참가자 화면에는 승인된 기존 SVG 픽셀 캐릭터가 계속 표시된다. 승인 전 관리자용
`pixel-layers-v3` 파일럿은 Universal LPC의 64×64 모듈형 캐릭터 파츠를 사용한다.

- 원본: https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator
- 라이선스: 파츠별 혼합(CC0, CC-BY 4.0, CC-BY-SA 3.0, OGA-BY 3.0, GPL 3.0)
- 저장 위치: `public/avatar-parts/vendor/universal-lpc/`
- 세부 저작자와 출처: 위 폴더의 `CREDITS.csv`와 `sheet_definitions/`

파일럿은 정면 보행 프레임에서 몸, 머리, 눈, 상의, 하의와 신발 레이어를 골라 최근접 이웃
방식으로 확대한다. 색상 변경을 지원하는 레이어만 결정적인 팔레트로 바꾸며 캐릭터 파츠를
AI로 다시 그리지 않는다. 개발자 아이템 4종은 기존 프로젝트 생성 에셋을 캐릭터 오른쪽
아래에 따로 배치한다.

`public/avatar-parts`의 PNG 두 장은 2026-08-31에 이 프로젝트를 위해 OpenAI 이미지 생성
도구로 만든 원본 에셋이다. v1 완성 캐릭터 아틀라스와 v2 파츠 콘셉트 기록이며, 현재
런타임 캐릭터는 어느 PNG도 직접 표시하지 않는다.

기존 아바타 URL API는 DiceBear의 `Pixel Art` 스타일로 SVG를 렌더링한다.

- DiceBear Core: MIT License, https://github.com/dicebear/dicebear
- DiceBear Pixel Art: CC0 1.0, https://www.dicebear.com/styles/pixel-art/

SVG API는 외부 아바타 API를 호출하지 않고 설치된 npm 패키지로 서버 안에서 생성한다.
현재 화면에서 쓰는 레이어 조합과 자세한 카탈로그는 `public/avatar-parts/README.md`에 있다.

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
