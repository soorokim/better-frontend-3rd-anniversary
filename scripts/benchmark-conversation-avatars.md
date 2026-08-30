# 대화 아바타 성능 측정

측정 결과에는 닉네임, 원본 user ID, 초대 코드, PIN, 세션, HMAC 키를 남기지 않는다. 시간과 성공/실패 개수, HTTP 상태 코드만 기록한다.

## 전원 분석

LXC에서 `time`으로 전체 분석을 한 번 실행한다. `AVATAR_HASH_KEY` 값은 셸 출력이나 명령 인자에 쓰지 않는다.

```bash
/usr/bin/time -f '{"metric":"full_analysis","elapsed_seconds":%e,"max_rss_kb":%M}' \
  python3 /opt/frontend-avatar/analyze_kakao_profiles.py \
  --db /opt/kakao-archive-next/data/archive.sqlite3 \
  --aliases /etc/frontend-avatar/private/kakao_participants.json \
  --all-participants --output /var/lib/frontend-avatar/profiles.json
```

목표는 15분 이하다. `merge_review` 때문에 종료 코드가 2여도 분석 시간 측정은 유효하지만 import 준비 완료로 세지는 않는다.

## 가입과 공개

테스트 DB의 승인 별칭만 사용해 30회 이상 가입 요청을 보내고 각 요청의 `time_total`을 기록한다. 원문 요청 본문은 결과 파일에 보존하지 않는다. 정렬한 값의 95번째 백분위가 2초 이하여야 한다.

브라우저 성능 표시는 다음 시점을 숫자만 남긴다.

- 제출 클릭 → 첫 `aria-live` 준비 문구: 1초 이하
- 제출 클릭 → `PLAYER READY`: p95 7초 이하
- 공개 애니메이션 자체: 3~5초

Playwright에서는 `performance.now()` 차이와 성공 여부만 출력한다. 결과 예시는 `{"metric":"reveal_ready","runs":30,"p95_ms":6120,"failures":0}` 형태로 남긴다.

## 가입 제한과 subject 격리

실제 닉네임이나 IP를 쓰지 않고, 삭제 가능한 테스트 DB와 합성 프로필 21개로만 실행한다.
목표는 정상 가입 p95가 2초 미만인지, 제한된 한 subject 때문에 다른 20명이 막히지
않는지를 확인하는 것이다.

## 준비

1. `TEST_DATABASE_URL`과 `DATABASE_URL`을 같은 loopback 테스트 DB로 지정한다.
2. 활성 행사와 합성 대화 프로필 21개를 만든다. 하나는 제한 확인용, 나머지 20개는 정상
   가입용으로 쓴다.
3. 테스트 서버를 production build로 실행한다. 측정 전에 정상 가입 1회를 별도 fixture로
   실행해 서버 시작 비용을 제외한다.

## 측정

1. 같은 합성 IP, 같은 미승인 닉네임으로 가입을 세 번 요청한다. 상태가
   `403, 403, 429`인지 확인하고 세 번째 응답의 `Retry-After`와
   `error.retryAfterSeconds`가 같은지 기록한다.
2. 제한된 요청 전후의 Argon2 `hash` 호출 수를 계측한다. 미승인 요청과 이미 제한된 요청의
   증가분은 각각 0이어야 한다.
3. 같은 합성 IP에서 서로 다른 승인 닉네임 20개를 동시에 가입시킨다. 각 요청의 시작과
   응답 완료 시간을 monotonic clock으로 재고, 20건 모두 201인지 확인한다.
4. 시간을 오름차순으로 정렬하고 `ceil(건수 × 0.95) - 1` 위치를 p95로 사용한다. 이번
   표본에서는 19번째 값이며 2,000ms 미만이어야 한다.
5. 참가자 수, 성공 수, p95, 제한 subject의 상태와 Argon2 호출 증가분만 검증 기록에 남긴다.
   닉네임, IP, PIN, 초대 코드, subject hash는 남기지 않는다.

통합 테스트의 동일 시나리오는 다음처럼 실행한다.

```bash
npx vitest run \
  tests/integration/participant-registration-throttle.test.ts \
  tests/integration/participant-auth-security.test.ts \
  tests/integration/conversation-avatar-register-api.test.ts \
  tests/integration/conversation-avatar-privacy.test.ts
```
