# Data Model: 대화 아바타 배포 준비

이번 구간은 `003`에서 설계한 대화 프로필 모델을 현재 진행자 기능 위에 안전하게
합치는 작업이다. 새 제품 테이블을 더 만들지 않는다. 가입 제한은 기존
`auth_throttles`의 action 값을 확장하고, 배포 검증 기록은 저장소 밖 CI 산출물 또는
검증 문서로 남긴다.

## 1. 최종 마이그레이션 계보

| 순서 | tag | 소유 기능 | 변경 원칙 |
| --- | --- | --- | --- |
| 0 | `0001_event_core` | 행사·참가자·답변·인증 | 수정하지 않음 |
| 1 | `0002_presenter_results` | 진행자 세션·발표 항목 | 현재 기준선 그대로 보존 |
| 2 | `0003_conversation_profiles` | 대화 프로필·별칭·아바타 연결·가입 제한 action | 병합된 최종 schema에서 생성 |

`meta/_journal.json`에는 위 세 항목만 순서대로 있어야 한다. `0002`라는 이름의 파일이
둘 있거나, journal tag와 SQL 파일이 다르거나, 최종 `db/schema.ts`에 진행자 또는 대화
프로필 엔티티 한쪽이 빠지면 배포 후보가 아니다.

`0003` 적용 실패 시 기존 `0001`·`0002` 데이터는 배포 직전 custom-format 백업을 기준으로
복구한다. 운영 DB에 down migration을 실행하거나 Docker volume을 삭제하지 않는다.

## 2. 기존 핵심 엔티티

### Participant

기존 `participants` 행이 계정의 유일한 기준이다.

- `id`: 계정 식별자. 별칭 로그인이나 PIN 초기화 뒤에도 바뀌지 않는다.
- `event_id`: 행사 범위.
- `nickname_display`, `nickname_key`: 프로필의 정식 닉네임으로 저장한다.
- `pin_hash`: PIN 초기화 때만 새 hash로 바뀐다.
- `auth_version`: 관리자가 PIN 초기화 코드를 발급할 때 증가하여 기존 세션을 폐기한다.
- `current_avatar_id`: 확정 대화 아바타 assignment를 가리킨다.

관계:

- Participant 1:N Answer
- Participant 1:N AvatarAssignment
- Participant 0..1:1 active ConversationProfile claim
- Participant 1:N PinResetGrant

### PresentationSession / PresentationItem

`0002_presenter_results`에서 이미 존재한다.

- `presentation_sessions`: 질문별 현재 항목, 작성자 공개 여부, revision을 보존한다.
- `presentation_items`: 답변·닉네임·아바타 traits를 발표 당시 snapshot으로 보존한다.
- 대화 아바타도 기존 `avatar_snapshot`의 `generatorVersion`, `catalogVersion`, `traits`를
  그대로 사용한다. conversation 전용 foreign key는 추가하지 않는다.

검증 규칙:

- `0003` 전후에 session 수, item 수, current item, revision, author reveal 값이 같아야 한다.
- 대화 아바타 참가자를 새로 발표할 때는 현재 확정 traits가 snapshot에 들어가야 한다.

## 3. `003`에서 가져오는 대화 프로필 엔티티

### ConversationProfileBatch

- 행사별 사전 분석 import 단위다.
- `status`: `staged | active | superseded | failed`.
- 행사당 `active`는 최대 하나다.
- `source_user_count >= profile_count >= 1`이고 payload digest는 64자 소문자 hex다.
- 이번 구간에서는 분석·선정 규칙을 바꾸지 않는다.

### ConversationProfile

- 활성 batch 안의 정식 닉네임, HMAC source digest, 확정 developer profile과 avatar option을 가진다.
- `claimed_participant_id`는 최대 한 profile에만 연결된다.
- profile claim과 participant/avatar 생성은 같은 transaction에서 확정한다.

### ConversationProfileAlias

- `canonical`, `approved_alias`, `discovered` 중 하나다.
- 같은 batch의 `alias_key`는 유일하다.
- 가입·로그인·PIN 초기화는 같은 Unicode NFKC 기반 nickname key로 이 테이블을 조회한다.
- alias의 batch, profile의 batch와 event가 일치해야 한다. 저장소 조회도 이 조건을 명시한다.

### AvatarAssignment

`0003`에서 기존 엔티티에 다음을 통합한다.

- `source_kind`: `nickname | conversation`.
- `source_digest`와 source kind 조합은 participant 안에서 유일하다.
- `conversation_profile_id`: conversation source인 경우 해당 profile을 가리킨다.
- `selected_traits`: 확정 class, item, status, display hash, DiceBear option을 저장한다.

새로고침·재로그인·PIN 초기화는 새 assignment를 만들지 않고 participant의 기존
`current_avatar_id`를 유지한다.

## 4. ParticipantNameResolution

별도 테이블이 아니라 공통 저장소 함수의 결과 모델이다.

입력:

- `eventId`
- `normalizedNicknameKey`
- 활성 ConversationProfileBatch

출력:

| 상태 | participantId | profileId | 의미 |
| --- | --- | --- | --- |
| `resolved` | 필수 | 필수 | 정식 닉네임 또는 승인 별칭이 한 계정에 연결됨 |
| `not_found` | 없음 | 없음 | 활성 승인 이름이 아니거나 아직 선점되지 않음 |
| `ambiguous` | 없음 | 없음 | 직접 닉네임과 별칭이 서로 다른 계정을 가리키거나 둘 이상의 일치가 발견됨 |

검증 규칙:

- 로그인과 PIN 초기화는 `resolved`만 사용한다.
- `not_found`와 `ambiguous`는 동일한 외부 인증 실패 문구를 사용하고 내부 ID를 반환하지 않는다.
- 가입은 활성 profile 별칭을 찾되 claim이 없을 때만 진행한다.
- PIN 변경은 participant ID로 실행하므로 answer와 avatar 관계를 갱신하지 않는다.

## 5. RegistrationAttemptState

기존 `auth_throttles` 행으로 표현한다.

필드:

- `action`: `participant_register`.
- `subject_key_hash`: `eventId + normalized nickname key + client IP`를 구분자로 연결한 HMAC digest.
- `failure_count`: 현재 15분 window에서 소비한 시도 수.
- `window_started_at`: window 시작.
- `blocked_until`: 제한이 없으면 null, 있으면 재시도 가능 시각.
- `updated_at`: 마지막 상태 변경 시각.

상태 전이:

```text
absent/expired
  └─ consume attempt ─> counting
counting
  ├─ successful registration ─> cleared
  ├─ consume below limit ──────> counting
  └─ consume at limit ─────────> blocked
blocked
  ├─ request before blockedUntil ─> blocked (Argon2 미실행)
  └─ window expiry ───────────────> counting
```

원자성 규칙:

- 같은 action/subject 행은 `SELECT ... FOR UPDATE` 또는 동등한 upsert 잠금으로 한 번에 갱신한다.
- 프로필 조회 전에 이미 차단된 subject인지 확인하고 차단 상태면 즉시 종료한다.
- 승인 프로필 조회 전에는 Argon2를 실행하지 않는다.
- 미승인 닉네임은 Argon2 없이 실패 횟수를 소비하며 같은 subject가 한도에 도달하면 차단한다.
- 비싼 해시 직전에 attempt를 소비하고, 이미 blocked면 해시를 실행하지 않는다.
- 성공한 subject만 clear한다. 다른 닉네임과 다른 출처의 행은 건드리지 않는다.

## 6. RevealAnnouncementState

클라이언트의 일시 상태이며 DB에 저장하지 않는다.

| 상태 | 시각 표시 | 보조기술 안내 | 상호작용 |
| --- | --- | --- | --- |
| `checking-motion` | 정적 준비 카드 | 없음 또는 준비 1회 | 임시 카드 비활성 |
| `shuffling` | 3~5초 후보 전환 | 준비 상태 최대 1회 | 임시 카드 비활성 |
| `ready` | 서버 확정 프로필 | 완료 상태 최대 1회 | 확정 카드 사용 가능 |

`prefers-reduced-motion: reduce`에서는 `checking-motion → ready`로 1초 안에 전환하며
`shuffling`과 interval을 만들지 않는다. 시각 후보 컨테이너는 `aria-hidden=true`이고,
보조기술 안내 영역에는 후보 class/item/status/hash를 넣지 않는다.

## 7. DeploymentValidationRecord

운영 DB 엔티티가 아니다. [deployment-validation.schema.json](./contracts/deployment-validation.schema.json)을
따르는 CI artifact 또는 검증 문서다.

필수 정보:

- 후보 commit SHA와 기준선 SHA
- `clean-install | existing-upgrade` 환경과 반복 회차
- 적용 전후 migration tag
- lint, typecheck, build, unit, analysis, integration, E2E 결과
- participant, answer, presentation session/item의 전후 개수
- 별칭 PIN 복구, 가입 제한, reduced motion, live-region 검증 결과
- 시작·종료 시각과 전체 판정

금지 정보:

- PIN, reset code, invite code, session/cookie, IP 원문
- 실제 닉네임, 답변 전문, 대화 원문, 카카오 user ID
