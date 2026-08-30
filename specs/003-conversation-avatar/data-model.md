# Data Model: 대화 기반 개발자 아바타

## 모델링 기준

- 분석 대상은 아카이브의 `is_system=0`, `message_count>0` 사용자 전원이다.
- 아카이브 원문은 PostgreSQL에 저장하지 않는다.
- 전체 배치는 검증을 모두 통과한 뒤 한 번에 활성화한다. 실패한 새 배치는 기존 활성 배치를 바꾸지 않는다.
- 가입 허용 여부는 별도 수동 명단이 아니라 활성 배치의 승인된 별칭으로 판정한다.
- 공개 중 잠깐 보이는 랜덤 캐릭터와 문구는 브라우저 상태일 뿐 저장하지 않는다.

## ConversationProfileBatch

전원 분석 한 번의 산출물과 활성화 상태를 나타낸다.

| 필드 | 형식 | 규칙 |
|---|---|---|
| `id` | UUID | 기본 키 |
| `eventId` | UUID | `events.id` 참조 |
| `schemaVersion` | text | `kakao-profile-analysis-v1` |
| `sourceVersion` | text | 분석 입력과 생성 규칙의 버전 |
| `selectionMode` | text | 이번 기능에서는 `all-non-system-message-authors` |
| `sourceUserCount` | integer | 시스템/메시지 0명 제외 후 원본 사용자 행 수, 1 이상 |
| `profileCount` | integer | 승인된 별칭 병합 후 프로필 수, 1 이상 |
| `mergedSourceRowCount` | integer | 둘 이상의 원본 사용자 행이 승인 병합된 프로필에 포함된 행 수, 0 이상 |
| `payloadDigest` | text | import JSON 전체의 SHA-256, 64자리 소문자 16진수 |
| `status` | enum | `staged`, `active`, `superseded`, `failed` |
| `failureReason` | text nullable | 실패한 배치의 운영자용 사유, 원문 포함 금지 |
| `importedAt` | timestamptz | 가져오기 완료 시각 |
| `activatedAt` | timestamptz nullable | 활성화 시각 |

관계와 제약:

- 이벤트 하나에는 활성 배치가 최대 하나만 있다.
- `(eventId, payloadDigest)`는 유일하다. 같은 파일을 다시 import해도 새 배치를 만들지 않는다.
- `profileCount`는 실제 자식 `ConversationProfile` 수와 일치해야 활성화할 수 있다.
- `sourceUserCount >= profileCount`다. 여러 원본 사용자 행이 승인된 별칭으로 한 사람에게 합쳐질 수 있기 때문이다. 두 수가 같을 필요는 없다.
- 분석기는 아카이브 안에서 각 원본 사용자 행이 정확히 한 프로필 또는 검토 항목에 포함됐는지 확인한다. 깨끗한 전달물에서는 프로필별 `sourceRowCount` 합계가 `sourceUserCount`와 같아야 하며, 충돌 검토 목록이 남아 있으면 배치를 저장하거나 활성화하지 않는다.

상태 전이:

```text
staged ──검증/저장 성공──> active ──새 배치 활성화──> superseded
   └────검증/저장 실패──> failed
```

`staged`나 `failed` 배치는 가입 허용 판단에 쓰지 않는다.

## ConversationProfile

원문 없이 저장하는 한 사람의 분석 요약과 확정 개발자 프로필이다.

| 필드 | 형식 | 규칙 |
|---|---|---|
| `id` | UUID | 기본 키 |
| `batchId` | UUID | `conversation_profile_batches.id` 참조 |
| `eventId` | UUID | 이벤트 범위 조회와 무결성 확인용 |
| `displayNickname` | text | 분석 결과에 표시할 대표 닉네임 |
| `nicknameKey` | text | 가입과 같은 NFKC/casefold/기호 제거 규칙으로 정규화 |
| `sourceVersion` | text | 분석 규칙 버전 |
| `sourceDigest` | text | HMAC-SHA-256 64자리 소문자 16진수 |
| `sourceRowCount` | integer | 이 프로필에 승인 병합된 원본 사용자 행 개수, 1 이상 |
| `profileData` | jsonb | 아래 `ProfileData` 구조 |
| `claimedParticipantId` | UUID nullable | 가입 후 `participants.id`, 전역 유일 |
| `claimedAt` | timestamptz nullable | 계정에 연결된 시각 |
| `createdAt` | timestamptz | 생성 시각 |
| `updatedAt` | timestamptz | 수정 시각 |

관계와 제약:

- `(batchId, nicknameKey)`는 유일하다.
- 활성 배치에 들어간 프로필은 모두 준비 완료 상태다. 분석 단계의 충돌은 DB 상태로 넣지 않고 import 전에 해결한다.
- `claimedParticipantId`는 하나의 프로필에만 연결된다.
- 프로필을 선점하고 참가자를 생성하는 작업은 같은 DB 트랜잭션에서 한다.
- 대화 원문, 개별 메시지 ID, 원본 카카오 user ID, PIN, 초대 코드는 넣지 않는다.

### ProfileData

| 필드 | 형식 | 규칙 |
|---|---|---|
| `signals` | object | `volume`, `consistency`, `night`, `story`, `curiosity`, `cheer`, `links`, `attachments`, `code`; 각각 0~1 |
| `adjectiveCandidates` | string[] | 근거가 있을 때만 넣는 중복 없는 0~3개 승인 문구 |
| `nounCandidates` | string[] | 근거가 있을 때만 넣는 중복 없는 0~6개 승인 문구 |
| `selectedAdjective` | string nullable | 후보가 있을 때만 확정 |
| `selectedNoun` | string nullable | 후보가 있을 때만 확정 |
| `className` | string nullable | 근거가 있는 형용사와 명사만 조합. 값이 없으면 UI에서 `—` 표시 |
| `item` | string | 승인된 개발자 장비 목록의 확정값 |
| `defaultStatus` | string | 최초 상태 문구 |
| `easterEggStatuses` | string[] | 중복 없는 승인 상태 문구 |
| `displayHash` | string | 예: `7A3F-C921`; 인증에 사용하지 않음 |
| `avatarSeed` | string | DiceBear 입력용 불투명 값. 원문이나 닉네임 자체가 아님 |
| `avatarOptions` | object | 픽셀 아바타의 버전 고정 옵션 |
| `generatorVersion` | string | 같은 입력에서 같은 결과를 재현할 생성기 버전 |

정확한 메시지 수나 날짜 범위는 배치 검증 보고서에서는 확인할 수 있지만 참가자용 API에는 내보내지 않는다.

## ConversationProfileAlias

대화방 닉네임과 사전 프로필을 연결하는 가입용 인덱스다.

| 필드 | 형식 | 규칙 |
|---|---|---|
| `id` | UUID | 기본 키 |
| `batchId` | UUID | 배치 참조 |
| `profileId` | UUID | 프로필 참조 |
| `displayAlias` | text | 원본 표시 이름 |
| `aliasKey` | text | 가입 닉네임과 같은 정규화 키 |
| `kind` | enum | `canonical`, `approved_alias`, `discovered` |
| `createdAt` | timestamptz | 생성 시각 |

관계와 제약:

- `(batchId, aliasKey)`는 유일하다. 같은 가입 키가 두 사람에게 연결되면 배치를 활성화하지 않는다.
- `canonical` 별칭은 프로필마다 정확히 하나다.
- 알려진 닉네임 변경은 `approved_alias`로 먼저 병합한다.
- 고유한 닉네임으로 자동 발견한 사용자도 전원 프로필로 만든다. 동일 정규화 키 충돌은 별도 분석 검토 목록으로 빼고, 운영자가 별칭 규칙을 수정해 재분석한 뒤에만 DB로 가져온다.

## Participant와 AvatarAssignment 변경

기존 `Participant`와 답변은 그대로 둔다. 신규 가입 또는 기존 사용자의 다음 로그인에서 활성 대화 프로필을 연결한다.

- 신규 가입: 승인 별칭 조회 → 프로필 선점 → `Participant` 생성 → PIN 해시 저장 → 대화 기반 `AvatarAssignment` 생성 → 현재 아바타 지정.
- 기존 참가자: 닉네임 기반 임시 아바타가 있으면 참가자와 답변은 유지하고 대화 기반 아바타를 새 현재 버전으로 지정한다.
- 대화 기반 아바타는 `conversationProfileId`, `generatorVersion`, 확정 `profileData`를 참조한다.
- 이전 아바타 행은 이력으로 남기고 `isCurrent=false`로 바꾼다.

## 가입 트랜잭션

```text
초대 코드 사전 확인 화면 통과
  → 활성 전체 프로필 배치 확인
  → 최종 가입 요청에서 초대 코드와 활성 배치 다시 확인
  → 활성 배치의 approved aliasKey 조회
  → 프로필을 행 잠금
  → 미선점 여부 확인
  → participant/PIN 생성 또는 기존 참가자 확인
  → conversation avatar 생성·현재값 지정
  → profile.claimedParticipantId 기록
  → commit
```

초대 코드는 맞지만 활성 전체 배치가 없으면 `profile_batch_not_ready`, 활성 배치에서 별칭 조회 결과가 없으면 `nickname_not_invited`, 이미 다른 참가자가 선점했으면 `nickname_taken`으로 끝낸다. 어느 실패에서도 참가자나 PIN을 일부만 만들지 않는다.

## 공개 화면 상태

이 상태는 DB 엔터티가 아니라 `AvatarReveal`의 클라이언트 상태다.

```text
idle → shuffling → ready
  └── prefers-reduced-motion ──> reduced-motion-ready
```

- `shuffling`은 3~5초 동안 임시 후보와 `~하는 중` 문구를 최소 3종 보여 준다.
- 임시 후보는 메모리에만 있고 API나 저장소로 보내지 않는다.
- 새로고침 뒤 서버는 이미 확정된 프로필을 다시 돌려주므로 계정과 아바타가 늘어나지 않는다.
