# Quickstart: 전원 대화 프로필 검증

이 문서는 구현 완료 뒤 실제 카카오 아카이브의 모든 일반 대화 참여자를 분석하고,
행사 서비스에서 가입까지 확인하는 운영 순서다. 분석 파일의 계약은
[`contracts/analysis-output.schema.json`](./contracts/analysis-output.schema.json), 저장 구조는
[`data-model.md`](./data-model.md)를 기준으로 한다.

## 준비

- 아카이브 SQLite를 읽을 수 있는 LXC 108 접근 권한
- LXC 안의 Python 3.11 이상
- 행사 서비스의 Node.js 22 이상과 PostgreSQL 17
- 저장소 밖에서 관리하는 충분히 긴 `AVATAR_HASH_KEY`
- `scripts/kakao_participants.example.json`을 참고해 Git 밖 서버 전용 경로에 준비한 실제 별칭 승인 파일
- 행사 DB 백업

비밀값은 명령줄 인자, 저장소, 분석 JSON에 직접 적지 않는다. LXC의 root 전용 환경
파일이나 배포 환경의 secret 저장소에서 주입한다.

## 1. 테스트용 분석 확인

먼저 작은 임시 SQLite 픽스처로 아래 동작을 확인한다.

```powershell
python -m unittest discover -s tests -p 'test_analyze_kakao_profiles.py'
```

기대 결과:

- 시스템 사용자는 제외된다.
- `message_count=0` 사용자는 제외된다.
- 알려진 별칭은 한 프로필로 합쳐진다.
- 별칭 파일에 없던 일반 사용자도 자동으로 포함된다.
- 같은 정규화 키의 미승인 원본 사용자 행은 자동으로 합쳐지지 않고 `merge_review`에 나온다.
- 출력에 메시지 본문이 없다.

## 2. 아카이브 안에서 전원 분석

분석 스크립트와 검토된 별칭 파일을 LXC로 복사한다. 실제 경로는 서버 배치 위치에
맞추되 SQLite는 읽기 전용 URI로 열린다.

```bash
python3 /opt/frontend-avatar/analyze_kakao_profiles.py \
  --db /opt/kakao-archive-next/data/archive.sqlite3 \
  --aliases /etc/frontend-avatar/private/kakao_participants.json \
  --all-participants \
  --output /var/lib/frontend-avatar/profiles.json
```

반드시 `AVATAR_HASH_KEY`가 주입된 셸에서 실행한다. `--all-participants`가 핵심이다.
별칭 JSON에 적힌 사람만 분석하는 옵션이 아니다. 알려진 별칭을 먼저 병합한 뒤,
메시지가 있는 나머지 비시스템 사용자를 전부 자동 발견한다.

기대 결과:

- `selection`은 `all-non-system-message-authors`다.
- `source_user_count`는 원본의 대상 사용자 행 수다.
- `matched_count`는 별칭 병합 후 만들어진 사람별 프로필 수다.
- `unmatched`, `alias_suggestions`, `merge_review`가 비어 있어야 import할 수 있다.
- `privacy.contains_message_bodies=false`이고 digest 방식은 `hmac-sha256`이다.

분석 도중 오류가 나면 기존 행사 DB에는 아무 변화도 생기지 않는다.

## 3. 산출물 계약 검증과 사람 확인

저장소의 공통 Zod 계약 검증 명령을 사용한다.

```bash
npm run avatar:validate -- /secure-transfer/profiles.json
```

운영자는 import 전에 다음을 한 번 직접 본다.

- 아카이브 안에서 대상 user 행 수와 `source_user_count`가 맞고 모든 원본 user ID가 정확히 한 프로필 또는 `merge_review` 항목에 포함됐는지
- `profiles.length == matched_count`인지
- 깨끗한 결과에서 모든 `source_row_count`의 합이 `source_user_count`와 같은지
- 각 승인 별칭이 정확히 한 프로필에만 속하는지
- 원본 사용자 행 수와 프로필 수가 다르면 `source_row_count>1`인 프로필의 별칭을 펼쳐 실제 병합 내역을 확인했는지
- 예상 밖의 병합이나 비어 있는 닉네임이 없는지
- JSON의 어느 키에도 `body`, `message_body`, `pin`, `invite_code`, 세션 값이 없는지

모든 사람을 자동 발견하더라도 같은 정규화 키나 유사한 닉네임을 추측으로 합치지는 않는다.
`merge_review`가 하나라도 있으면 파일을 행사 서버로 옮기지 않는다. 운영자가 목록을 보고
같은 사람임을 승인한 항목만 별칭 파일의 `source_user_ids`와 별칭에 기록한 뒤 전체 분석을
다시 돌린다. 다른 사람인데 가입 닉네임이 충돌한다면 원본 user ID별로 서로 다른 행사 가입
닉네임을 정한 뒤 서버 전용 별칭 규칙에 기록한다. `merge_review`가 비어진 최종 전달 JSON에는
`user_id`, `source_user_ids` 같은 원본 식별자 키가 없어야 한다.

## 4. 행사 DB에 원자적으로 import

먼저 행사 DB를 백업하고, 검증을 마친 JSON만 앱 서버의 제한된 임시 경로로 옮긴다.

```bash
npm run avatar:import -- /secure-transfer/profiles.json
```

운영 호스트에 Node.js를 따로 설치하지 않았다면 Compose의 `migrate` 실행 환경을 일회용으로 사용한다. 아래 `/srv/avatar-transfer`는 최종 JSON 하나만 둔 실제 제한 폴더로 바꾼다.

```bash
docker compose run --rm \
  -v /srv/avatar-transfer:/secure-transfer:ro \
  migrate sh -c 'npm ci --include=dev && npm run avatar:validate -- /secure-transfer/profiles.json && npm run avatar:import -- /secure-transfer/profiles.json'
```

기대 결과:

- JSON 전체를 먼저 검증한다.
- 배치, 프로필, 별칭, 확정 아바타가 하나의 트랜잭션으로 저장된다.
- 전원 저장과 고유성 검증에 성공한 뒤에만 새 배치가 활성화된다.
- 실패하면 이전 활성 배치가 그대로 남는다.
- 같은 파일을 다시 가져와도 중복 배치나 프로필이 생기지 않는다.

## 5. 서비스 검증

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

브라우저에서는 아래 흐름을 확인한다.

1. 운영자 화면에 활성 배치의 `sourceUserCount`, `profileCount`, 승인 병합 별칭·원본 행 개수와 준비·가입 수가 보이고 원본 user ID는 보이지 않는다.
2. 초대 코드를 서버에서 확인하기 전에는 닉네임과 PIN 입력 단계가 열리지 않는다. 올바른 코드라도 활성 전체 배치가 없으면 준비 중 안내에서 멈추고, 배치가 있을 때만 다음 단계로 이동한다.
3. 활성 프로필의 승인 별칭으로 최종 가입하면 1초 안에 준비 상태가 보이고 가입 API의 95%가 2초 안에 완료된다.
4. 3~5초 동안 임시 캐릭터와 `~하는 중` 문구가 각각 세 종류 이상 바뀐 뒤 제출 후 7초 안에 확정 결과로 멈춘다.
5. 새로고침하거나 다시 로그인해도 같은 클래스, 장비, 해시, 픽셀 캐릭터가 나온다.
6. 활성 배치에 없는 닉네임은 계정, PIN, 임시 아바타를 하나도 만들지 않고 거절된다.
7. `prefers-reduced-motion`에서는 빠른 교체 없이 1초 안에 정적인 준비 상태와 확정 결과를 볼 수 있다.

가입 API의 응답과 오류 코드는 [`contracts/openapi.yaml`](./contracts/openapi.yaml)을 따른다.

## 6. 반출 파일 정리

import와 검증이 끝나면 분석 JSON은 운영 정책에 맞는 제한된 보관 위치로 옮기거나
안전하게 폐기한다. 아카이브 원문 DB는 원래 LXC에 그대로 둔다. 앱 컨테이너와 Docker
이미지, Git 저장소에는 분석 JSON이나 HMAC 키를 넣지 않는다.
