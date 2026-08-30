# Data Model: 3주년 행사 기본 참여 흐름

## 공통 규칙

- 모든 업무 엔티티는 닉네임 대신 서버에서 생성한 UUID를 기본 식별자로 사용한다.
- 모든 시각은 UTC 기준으로 저장하고 화면에서 행사 시간대로 변환한다.
- 삭제보다 상태 전환과 만료를 우선한다. 이번 구간에는 참가자 영구 삭제 기능이 없다.
- 인증 원문, 세션 토큰 원문, 초대 코드 원문, PIN 초기화 코드 원문은 저장하지 않는다.
- 주요 변경은 하나의 트랜잭션으로 처리한다.

## 닉네임 정규화 규칙 `nickname-key-v1`

1. 잘못된 UTF-16과 단독 surrogate를 거부한다.
2. Unicode NFC로 정규화한다.
3. 앞뒤 공백을 제거한다.
4. 줄바꿈, 제어 문자, 양방향 텍스트 제어 문자를 거부한다.
5. 기본 Unicode 소문자 변환 후 다시 NFC 정규화한다.
6. 1~24개 grapheme cluster 범위를 확인한다.

화면에는 입력 당시의 NFC 닉네임을 보존하고, 고유성 검사와 로그인에는 `nickname_key`를
사용한다. 규칙이 바뀌면 기존 값을 조용히 다시 계산하지 않고 새 버전의 명시적 마이그레이션을
만든다.

## Entity: Event

행사 한 건과 참가 가능 상태를 나타낸다.

| Field | Type | Rules |
|------|------|-------|
| id | UUID | Primary key, 생성 후 변경 금지 |
| slug | string | Unique, URL과 운영 식별자 |
| title | string | 1~100자 |
| invite_code_hash | string | Argon2id 결과만 저장 |
| registration_open | boolean | false이면 신규 참가자 등록 거부 |
| created_at | timestamp | 생성 시각 |
| updated_at | timestamp | 최근 변경 시각 |

**Relationships**: Event 1:N Participant, Event 1:N Question, Event 1:N AdminAccount

## Entity: Participant

행사 참가자의 안정된 신원이다. 닉네임이나 아바타가 바뀌어도 ID와 답변 관계는 유지된다.

| Field | Type | Rules |
|------|------|-------|
| id | UUID | Primary key |
| event_id | UUID | Event foreign key |
| nickname_display | string | NFC 정규화된 표시값, 1~24 grapheme |
| nickname_key | string | `nickname-key-v1` 결과 |
| nickname_rule_version | string | 기본값 `nickname-key-v1` |
| pin_hash | string | Argon2id + pepper 검증값 |
| auth_version | integer | 1부터 시작, PIN 초기화 때 증가 |
| current_avatar_id | UUID nullable | 현재 AvatarAssignment |
| created_at | timestamp | 등록 시각 |
| updated_at | timestamp | 최근 변경 시각 |

**Constraints**:

- `(event_id, nickname_key)` unique
- `auth_version >= 1`
- 참가자 답변과 세션은 `nickname_key`가 아니라 `id`를 참조한다.

## Entity: AvatarAssignment

한 시점에 참가자에게 배정된 결정적 픽셀 캐릭터다. 새 생성은 기존 행을 덮어쓰지 않는다.

| Field | Type | Rules |
|------|------|-------|
| id | UUID | Primary key |
| participant_id | UUID | Participant foreign key |
| source_kind | enum | `nickname`, 향후 `conversation` |
| source_version | string | 1차 `nickname-key-v1` |
| source_digest | string | 원문이 아닌 32바이트 digest의 인코딩 값 |
| generator_version | string | 1차 `pixel-avatar-v1` |
| catalog_version | string | 1차 `pixel-parts-v1` |
| selected_traits | JSON | 안정된 파츠 ID 목록 |
| supersedes_id | UUID nullable | 이전 배정 참조 |
| created_at | timestamp | 생성 시각 |

**Validation**:

- `selected_traits`는 `hair-03`, `face-02`처럼 카탈로그의 안정된 ID만 가진다.
- 기존 카탈로그의 파츠 순서와 의미는 변경하지 않는다. 변경은 새 catalog version으로 만든다.
- 참가자별 현재 배정은 `Participant.current_avatar_id` 하나뿐이다.

## Entity: Question

행사에서 제공하는 3주년 질문이다. 이번 구간에서는 한 번에 하나만 공개한다.

| Field | Type | Rules |
|------|------|-------|
| id | UUID | Primary key |
| event_id | UUID | Event foreign key |
| prompt | string | 공백 제외 1~500자 |
| status | enum | `draft`, `published`, `closed` |
| published_at | timestamp nullable | 최초 공개 시각 |
| created_at | timestamp | 생성 시각 |
| updated_at | timestamp | 최근 변경 시각 |

**Constraint**: 행사별 `published` 질문은 최대 1개다.

## Entity: Answer

참가자가 질문에 남긴 최신 답변이다.

| Field | Type | Rules |
|------|------|-------|
| id | UUID | Primary key |
| participant_id | UUID | Participant foreign key |
| question_id | UUID | Question foreign key |
| content | string | 공백 제외 1~1,000자 |
| submitted_at | timestamp | 최초 저장 시각 |
| updated_at | timestamp | 최근 성공한 수정 시각 |

**Constraints**:

- `(participant_id, question_id)` unique
- 작성자 본인 세션만 읽고 쓸 수 있다.
- 수정은 새 내용을 검증한 뒤 원자적으로 최신 값을 교체한다.

## Entity: ParticipantSession

참가자 로그인 상태를 서버에서 통제하는 불투명 세션이다.

| Field | Type | Rules |
|------|------|-------|
| id | UUID | Primary key |
| participant_id | UUID | Participant foreign key |
| token_hash | string | Unique, 원본 토큰 저장 금지 |
| csrf_hash | string | 상태 변경 요청 검증값 |
| auth_version | integer | 발급 당시 Participant.auth_version |
| created_at | timestamp | 발급 시각 |
| last_seen_at | timestamp | 유휴 만료 계산 기준 |
| expires_at | timestamp | 절대 만료, 발급 후 최대 12시간 |
| revoked_at | timestamp nullable | 로그아웃·초기화 시각 |

**Valid state**: 미폐기, 유휴 30분 이내, 절대 만료 전, 참가자의 현재 auth_version과 일치

## Entity: AdminAccount

진행자 인증 정보다. 이번 구간에서는 행사별 한 계정만 사용한다.

| Field | Type | Rules |
|------|------|-------|
| id | UUID | Primary key |
| event_id | UUID | Event foreign key |
| username | string | 행사 내 unique |
| password_hash | string | Argon2id + pepper 검증값 |
| auth_version | integer | 1 이상 |
| created_at | timestamp | 생성 시각 |
| updated_at | timestamp | 변경 시각 |

## Entity: AdminSession

| Field | Type | Rules |
|------|------|-------|
| id | UUID | Primary key |
| admin_id | UUID | AdminAccount foreign key |
| token_hash | string | Unique, 원본 저장 금지 |
| csrf_hash | string | 상태 변경 요청 검증값 |
| auth_version | integer | 발급 당시 값 |
| authenticated_at | timestamp | PIN 초기화 재인증 기준 |
| last_seen_at | timestamp | 유휴 만료 15분 기준 |
| expires_at | timestamp | 절대 만료 4시간 |
| revoked_at | timestamp nullable | 폐기 시각 |

## Entity: PinResetGrant

관리자가 참가자에게 전달하는 짧은 일회용 초기화 권한이다.

| Field | Type | Rules |
|------|------|-------|
| id | UUID | Primary key |
| participant_id | UUID | Participant foreign key |
| code_hash | string | 8자리 코드 원문 저장 금지 |
| failure_count | integer | 0~5 |
| expires_at | timestamp | 생성 후 10분 |
| used_at | timestamp nullable | 성공 사용 시각 |
| revoked_at | timestamp nullable | 재발급·실패 초과 시각 |
| created_by_admin_id | UUID | AdminAccount foreign key |
| created_at | timestamp | 생성 시각 |

**Valid state**: 미사용, 미폐기, 만료 전, 실패 5회 미만

## Entity: AuthThrottle

온라인 추측 시도를 점진적으로 늦추기 위한 서버 상태다.

| Field | Type | Rules |
|------|------|-------|
| id | UUID | Primary key |
| action | enum | `invite`, `participant_login`, `admin_login`, `pin_reset` |
| subject_key_hash | string | 닉네임·IP 등의 원문을 남기지 않은 범위 키 |
| failure_count | integer | 현재 구간 실패 수 |
| window_started_at | timestamp | 계산 구간 시작 |
| blocked_until | timestamp nullable | 다음 허용 시각 |
| updated_at | timestamp | 최근 변경 시각 |

카운터 증가는 원자적으로 처리한다. 영구 잠금은 사용하지 않는다.

## Entity: AuditEvent

관리자 인증과 PIN 초기화처럼 민감한 운영 동작의 최소 기록이다.

| Field | Type | Rules |
|------|------|-------|
| id | UUID | Primary key |
| event_id | UUID | Event foreign key |
| admin_id | UUID nullable | 실패 로그인은 null 가능 |
| action | string | 허용된 이벤트 이름 |
| target_participant_id | UUID nullable | 초기화 대상 |
| outcome | enum | `success`, `failure` |
| created_at | timestamp | 발생 시각 |

비밀번호, PIN, 초대 코드, reset code, 세션 ID와 답변 본문은 기록하지 않는다.

## State Transitions

### 참가자 인증

```text
미등록 → 초대 코드 검증 → 닉네임/PIN 등록 → 활성
활성 → PIN 로그인 → 세션 활성
세션 활성 → 로그아웃/만료/PIN 초기화 → 세션 폐기
활성 → 관리자 PIN 초기화 → 재설정 대기 → 새 PIN 설정 → 활성
```

PIN 초기화 트랜잭션은 `auth_version` 증가, 기존 세션 폐기, 기존 grant 폐기, 새 grant 생성을
함께 처리한다. 새 PIN 설정 트랜잭션은 grant 사용 처리와 PIN hash 교체를 함께 처리한다.

### 질문과 답변

```text
Question: draft → published → closed
Answer: 없음 → 저장됨 → 수정됨
```

질문이 `published`일 때만 답변을 새로 저장하거나 수정할 수 있다. 이번 구간에서는 답변을
삭제 상태로 바꾸지 않는다.

### 아바타 배정

```text
미배정 → nickname 기반 v1 배정
현재 배정 → 명시적 재생성 → 새 배정(이전 배정 보존)
```

대화 지문 기능이 추가되더라도 Participant와 Answer ID는 유지하고 새 AvatarAssignment만
생성한다.
