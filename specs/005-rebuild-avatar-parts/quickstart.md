# Quickstart: 모듈형 픽셀 아바타 재구성 검증

이 문서는 `pixel-layers-v3` 구현 뒤 파일럿 승인과 전체 전환을 검증하는 순서다. 운영 DB와
운영 Compose project를 시험에 사용하지 않는다. 데이터 구조는 [data-model.md](data-model.md),
manifest와 화면 규칙은 [contracts](contracts/)를 기준으로 한다.

## 1. 준비

```powershell
npm ci
npx playwright install chromium
npm run typecheck
npm run lint
```

예상 결과: 의존성 설치와 정적 검사가 오류 없이 끝난다. `.env`, 참가자 데이터와 인증 값은
Git에 추가하지 않는다.

원본 atlas를 다시 정리해야 할 때만 오프라인 제작 의존성을 설치한다. 운영 app 컨테이너에는
Python이나 Pillow가 필요하지 않다.

```powershell
python -m pip install -r scripts/requirements-avatar.txt
```

## 2. 기존 배정 불변성 확인

```powershell
npx vitest run tests/unit/avatar-assignment-regression.test.ts tests/unit/avatar-presentation.test.ts --reporter=dot
```

예상 결과:

- `pixel-parts-v1`, `avatar-generator-v1`과 카탈로그 ID 순서가 기존 fixture와 같다.
- 저장 조합 1,200개가 이전과 같은 canonical traits를 만든다.
- `terminal→laptop`, `book→error-log`와 대화 장비 8개의 시각 별칭이 기대한 item ID로 해석된다.

## 3. 정적 에셋 계약 검사

```powershell
npm run avatar:assets:validate
npx vitest run tests/unit/avatar-assets.test.ts tests/unit/pixel-avatar.test.tsx --reporter=dot
```

예상 결과:

- manifest와 모든 경로·checksum·provenance가 일치한다.
- 모든 PNG가 256×384 RGBA이며 alpha는 0 또는 255만 사용한다.
- 보이는 픽셀은 safe bounds와 baseline을 지킨다.
- hairFront와 item의 face mask 침범은 0이고 item의 torso mask 침범은 30% 이하다.
- 저장 입력을 canonical 시각 상태로 정규화한 2,160개 조합에 빈 파츠가 없다.
- active asset set은 `phase=approved`와 승인 기록 없이는 선택되지 않는다.

## 4. 대표 조합 4개 시각 승인

후보 manifest는 `phase=pilot`으로 둔다. 기존 승인 에셋은 계속 참가자 화면에 사용한다.

```powershell
$env:AVATAR_LAB_ENABLED='true'
npm run dev
```

관리자로 로그인한 뒤 `/admin/avatar-review?mode=pilot`을 연다. 다음을 확인한다.

- 360px 모바일 로비에서 얼굴, 전신과 아이템이 잘리지 않는다.
- 192px에서 네 아이템을 이름표 없이 구분할 수 있다.
- 48/52/76/80px 문맥에서 같은 조합이며 위치가 흔들리거나 흐려지지 않는다.
- 머리, 옷과 item에 손·발·얼굴이 중복되지 않는다.
- 긴 머리, 높은 머리, 넓은 옷과 큰/작은 아이템이 얼굴과 몸통 제한을 지킨다.

각 조합과 문맥의 pass/fail, 이유와 요소 스크린샷 경로를
`validation/pilot-review.md`에 기록한다. 한 항목이라도 fail이면 manifest를 승인으로 바꾸거나
전체 파츠 제작으로 넘어가지 않는다.

기준 스크린샷은 네 조합이 사람 검토를 통과한 시점에만 갱신한다.

```powershell
npx playwright test tests/e2e/avatar-visual.spec.ts --project=avatar-visual-chrome --update-snapshots
```

## 5. 브라우저 실제 문맥과 fallback 검사

```powershell
npx playwright test tests/e2e/avatar-visual.spec.ts tests/e2e/avatar-context-parity.spec.ts --project=avatar-visual-chrome
```

예상 결과:

- 360px 로비와 48/52/76/80/192px 실제 크기에서 전신이 잘리지 않고 픽셀 스타일을 유지한다.
- 같은 참가자의 `data-avatar-combination`과 asset set이 로비, 관리자와 진행자 화면에서 같다.
- body, hair, outfit, item 요청을 각각 실패시켜도 부분 레이어가 보이지 않고 완성된 fallback 하나만 보인다.
- 참가자 화면의 진단 정보에는 닉네임, 해시와 대화 내용이 포함되지 않는다.

## 6. 전체 에셋 승인

대표 조합이 승인된 뒤 나머지 파츠를 같은 기준으로 만든다. `mode=parts`에서 각 파츠 역할을,
`mode=all`과 생성된 contact sheet에서 2,160개 canonical 화면 조합을 검토한다.

다음 조건을 모두 만족한 뒤에만 manifest를 `phase=approved`, review를 `approved`로 바꾸고
활성 렌더러를 `pixel-layers-v3`로 전환한다.

- 정적 에셋 검사 통과
- 대표 4개 승인 기록 완성
- 2,160개 조합에 누락·fallback·경계 이탈 0건
- 모든 아이템의 192px 식별 성공
- `README.md`, `public/avatar-parts/README.md`, `THIRD_PARTY_NOTICES.md`의 실제 사용 에셋과 출처 설명 일치

## 7. 전체 회귀와 빌드

```powershell
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run test:e2e
npm run build
```

통합 테스트는 이름에 `test`가 포함된 별도 PostgreSQL과 `TEST_DATABASE_URL`을 사용한다.
운영 DB URL이면 실행하지 않는다.

## 8. 격리 Docker 확인

삭제 가능한 별도 Compose project와 포트를 사용한다.

```powershell
$env:APP_PORT='3105'
docker compose -p avatar-005 config --quiet
docker compose -p avatar-005 build app
docker compose -p avatar-005 up -d
docker compose -p avatar-005 ps -a
```

새 `v3` 파일이 최종 app 이미지의 `/public/avatar-parts/v3`에 포함되고 health가 정상인지 확인한다.
호스트 Playwright에서 격리 서버를 검사한다.

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3105'
npx playwright test tests/e2e/avatar-visual.spec.ts --project=avatar-visual-chrome
```

검증용 project임을 다시 확인한 경우에만 해당 project의 volume을 정리한다. 운영 project나
운영 PostgreSQL volume에는 `down -v`를 사용하지 않는다.

## 완료 기준

- 대표 4개와 전체 2,160개 시각 조합의 자동/사람 검토가 모두 통과했다.
- 기존 참가자의 해시, 클래스, 상태, 아이템과 저장 traits 변경이 0건이다.
- 참가자, 관리자와 진행자 화면이 같은 승인 에셋 세트를 사용한다.
- 에셋 누락 상황에서 조각난 캐릭터 노출이 0건이다.
- 깨끗한 설치와 격리 Docker 이미지에서 같은 결과를 재현한다.
