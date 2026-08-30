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
