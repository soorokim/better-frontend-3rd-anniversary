# US3 가입 제한 검증 기록

검증일: 2026-08-30

대상: `codex/conversation-avatar` 로컬 후보

환경: Windows Node.js + loopback 전용 PostgreSQL 16 테스트 DB

실제 닉네임, IP, PIN, 초대 코드와 subject hash는 기록하지 않았다. 모든 가입 데이터는
합성 fixture이며 검증 뒤 테스트 DB를 폐기한다.

## 결과

- 같은 event·닉네임·출처 subject의 미승인 요청은 `403, 403, 429` 순서로 제한됐다.
- 다른 닉네임 또는 다른 출처의 subject는 제한 상태를 공유하지 않았다.
- 동시에 소비한 가입 슬롯 3개 중 2개만 허용됐고 1개는 원자적으로 차단됐다.
- 15분 창이 지난 행은 새 창의 첫 시도로 처리됐다.
- 성공 가입 뒤 해당 subject만 삭제되고 다른 subject의 제한 행은 유지됐다.
- 미승인 닉네임의 Argon2 PIN 해시 호출 증가분은 0회였다.
- 이미 제한된 승인 닉네임의 Argon2 PIN 해시 호출 증가분도 0회였다.
- 같은 승인 프로필을 동시에 선점한 세 요청 중 참가자 생성은 정확히 1건이었다. 나머지는
  내부 오류 없이 `409 nickname_taken`으로 끝났다.
- 가입 429의 `Retry-After` 헤더와 `error.retryAfterSeconds`는 같은 양의 정수였다.
- 제한된 subject와 같은 합성 출처에서 서로 다른 승인 닉네임 20명이 모두 가입했다.
- 20건 동시 정상 가입의 p95는 342ms로 2,000ms 기준 안에 들어왔다.
- 제한 로그에는 동작명과 결과만 남고 원문 출처, 닉네임, 자격 증명은 남지 않았다.

## 실행한 검사

```text
npx vitest run <US3 관련 통합 테스트 4개>
  4 files, 15 tests passed

npm run test:integration -- --silent --reporter=dot
  19 files, 77 tests passed

npm test
  12 files, 57 tests passed

npm run test:analysis
  2 tests passed

npm run typecheck
npm run lint -- --quiet
npm run build
  모두 종료 코드 0
```

Docker Compose 새 설치와 기존 DB 업그레이드 반복 검증은 US3 범위가 아니라 뒤의 배포 검증
구간에서 진행한다.
