# US1 candidate clone 스모크

- candidate SHA: `173066a54411b831353ad44af23958fad3e319ce`
- 시작: 2026-08-30T18:04:37.2694550+09:00
- 종료: 2026-08-30T18:05:00.5754377+09:00
- 소스 전달: 로컬 저장소를 임시 디렉터리에 `git clone --no-local --no-checkout`한 뒤
  candidate SHA를 detached checkout했다.
- DB 격리: WSL의 사용자 전용 portable PostgreSQL 16.2, UTF-8, loopback 전용 포트와
  이름에 `test`가 포함된 삭제 가능한 DB만 사용했다. 운영 DB와 행사 Compose project는
  연결하거나 변경하지 않았다.

## 결과

- checkout HEAD가 candidate SHA와 일치: 통과
- 필수 추적 파일 확인: 통과. `0001_event_core`, `0002_presenter_results`,
  `0003_conversation_profiles`, journal, 관리자 현황 UI, Compose와 배포·백업·복원 스크립트가
  모두 Git 추적 상태였다.
- clone 직후 `git status --porcelain`: 깨끗함
- `npm ci`: 통과, 잠금 파일 기준 481개 패키지 설치
- 빈 DB 설치 및 migration 재실행:
  `tests/integration/bootstrap.test.ts` 5개 테스트 통과
- `0002_presenter_results` 기존 DB 1회 갱신 및 migration 재실행:
  `tests/integration/presentation-concurrency.test.ts`의 upgrade 테스트 1개 통과
- 참가자·답변·presentation session/item, revision, 작성자 공개 상태, 현재 item과 avatar
  snapshot 보존: 통과
- 테스트 뒤 `git status --porcelain`: 깨끗함

`npm ci` audit 요약의 moderate 4건과 high 5건은 기존 잠금 파일 결과다. 스모크 범위에서는
breaking 변경 가능성이 있는 자동 수정은 적용하지 않았다.
