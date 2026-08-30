# Data Model: 진행자 결과 발표 화면

## 공통 규칙

- 기존 Event, Question, Answer, Participant, AvatarAssignment와 AdminAccount가 기준 데이터다.
- 발표 상태는 질문별로 하나만 활성화하며 브라우저 저장소를 기준 데이터로 사용하지 않는다.
- 원본 Answer는 읽기만 하고 발표 과정에서 수정하거나 삭제하지 않는다.
- 답변, 닉네임과 캐릭터는 한 번의 일관된 조회 결과로 스냅샷을 만든다.
- 모든 시각은 UTC로 저장하고 화면에서 행사 시간대로 바꾼다.
- 답변 본문과 작성자 스냅샷은 로그와 감사 이벤트 payload에 남기지 않는다.

## Existing Entity: Question

현재 `published` 상태인 질문 하나가 발표 세션의 범위가 된다. 질문이 바뀌면 기존 세션을
재사용하지 않고 새 질문의 세션을 별도로 만든다.

**Relationship**: Question 1:0..1 PresentationSession

## Existing Entity: Answer

발표 후보의 원본이다. 현재 질문에 실제 저장된 Answer만 후보가 되며, 발표 항목 존재 여부로
미공개와 공개 완료를 구분한다.

**Relationship**: Answer 1:0..1 PresentationItem within one question session

## Entity: PresentationSession

질문 한 건의 현재 발표 포인터와 동기화 revision을 보관한다.

| Field | Type | Rules |
|------|------|-------|
| id | UUID | Primary key |
| event_id | UUID | Event foreign key, 관리자 행사 경계 확인용 |
| question_id | UUID | Question foreign key, unique |
| current_item_id | UUID nullable | 현재 PresentationItem, 대기 상태면 null |
| author_revealed | boolean | 기본 false, 답변 선택·이동 때 false로 초기화 |
| revision | integer | 0 이상, 성공한 상태 변경마다 1 증가 |
| started_at | timestamp | 첫 명령으로 세션을 만든 시각 |
| updated_at | timestamp | 최근 성공한 상태 변경 시각 |

**Constraints**:

- `question_id` unique
- `revision >= 0`
- `current_item_id`는 같은 세션에 속한 PresentationItem이어야 한다. 서비스 트랜잭션에서
  검증하고 외래 키는 항목 삭제 시 null 처리한다.
- `event_id`는 Question.event_id와 같아야 한다. 세션 생성 서비스가 관리자 event_id로
  질문을 조회한 뒤 함께 저장한다.

**Derived states**:

- `waiting`: current_item_id가 null
- `presenting`: current_item_id가 존재
- `all_presented`: 현재 질문의 Answer 수가 1 이상이고 PresentationItem 수와 같음

## Entity: PresentationItem

현재 발표 세션에서 한 번 이상 공개한 답변과 최초 순서, 마지막 선택 스냅샷을 보관한다.

| Field | Type | Rules |
|------|------|-------|
| id | UUID | Primary key |
| presentation_session_id | UUID | PresentationSession foreign key |
| answer_id | UUID | Answer foreign key |
| content_snapshot | string | 선택 당시 성공본, 공백 제외 1~1,000자 |
| answer_updated_at_snapshot | timestamp | 어떤 Answer 버전을 표시했는지 확인하는 시각 |
| nickname_snapshot | string | 선택 당시 참가자 표시 닉네임 |
| avatar_snapshot | JSON | generator/catalog version과 공개 traits의 완전한 표시값 |
| presentation_order | integer | 최초 공개 순서, 1부터 시작 |
| first_presented_at | timestamp | 최초 공개 시각, 변경하지 않음 |
| last_selected_at | timestamp | 최신 선택·재선택 시각 |

**Constraints**:

- `(presentation_session_id, answer_id)` unique
- `(presentation_session_id, presentation_order)` unique
- `presentation_order > 0`
- Answer.question_id는 Session.question_id와 같고, Answer의 Participant.event_id는
  Session.event_id와 같아야 한다. 스냅샷 조회에서 두 경계를 함께 확인한다.
- avatar_snapshot은 기존 공개 AvatarView에 필요한 generatorVersion, catalogVersion,
  traits만 가진다. 내부 source digest나 대화 분석값은 포함하지 않는다.

## Query Views

### Presenter Controller View

관리자 조작 화면에만 제공한다.

- 행사와 현재 질문
- 전체·제출·미제출 수
- revision, 현재 항목, 작성자 공개 여부, 모두 공개 여부
- 현재 슬라이드 스냅샷
- 현재 질문의 최신 Answer 후보와 작성자 공개 AvatarView
- 후보별 `unpresented`, `presented`, `current` 상태와 최초 발표 순서

### Presentation Screen View

발표 화면에 필요한 allowlist만 새 객체로 조립한다.

- 질문 문구
- `waiting` 또는 `answer` 상태
- 현재 content_snapshot
- revision과 최근 변경 시각
- author_revealed가 true일 때만 nickname_snapshot과 avatar_snapshot

Answer ID, Participant ID, 전체 후보, 제출 현황, 미공개 작성자 정보는 포함하지 않는다.

## Transaction Rules

### Session preparation

1. 관리자 event_id 안의 현재 published Question을 조회한다.
2. 질문의 PresentationSession이 없으면 revision 0, current null로 생성한다.
3. 충돌 생성은 무시하고 같은 세션을 다시 조회한다.

### Select a specific answer

1. Session 행을 잠근다.
2. answer_id가 Session의 질문·행사에 속하는지 Answer→Participant→현재 Avatar를 한 번에
   조회해 확인한다.
3. 처음 선택이면 다음 presentation_order로 Item을 만든다. 재선택이면 최초 순서는 유지하고
   content, answer updated 시각, nickname, avatar 스냅샷과 last_selected_at만 갱신한다.
4. current_item_id를 선택한 Item으로 바꾸고 author_revealed를 false로 만든다.
5. revision을 1 올리고 커밋한다.

### Select a random answer

Session을 잠근 뒤 현재 질문 Answer 중 이 Session의 Item이 없는 후보만 고른다. 후보가 없으면
상태를 바꾸지 않고 모두 공개됐다는 오류를 반환한다. 선택 뒤 규칙은 특정 답변 선택과 같다.

### Navigate

Session을 잠그고 현재 presentation_order의 앞 또는 뒤 Item을 찾는다. 대상이 있으면
current_item_id를 바꾸고 author_revealed를 false로 초기화한 뒤 revision을 올린다. 기존
스냅샷과 최초 순서는 바꾸지 않는다.

### Set author visibility

현재 Item이 있는지 확인한 뒤 author_revealed를 요청한 최종 boolean 값으로 저장하고 revision을
올린다. 현재 항목이 없으면 상태를 바꾸지 않는다.

### Restart presentation

명시적 확인값을 검증한 뒤 Session을 잠근다. current_item_id를 null, author_revealed를 false로
먼저 바꾸고 해당 Session의 Item만 삭제한다. revision은 기존 값에서 계속 증가시켜 오래된
클라이언트 상태와 구분한다. 원본 Answer는 건드리지 않는다.

## State Transitions

```text
세션 없음 → 첫 진행 명령 → waiting session
waiting → 답변 선택 → presenting(anonymous)
presenting(anonymous) → 작성자 공개 → presenting(revealed)
presenting(revealed) → 작성자 숨김 → presenting(anonymous)
presenting → 이전/다음/다른 답변 → presenting(anonymous)
모든 답변이 Item에 존재 → all_presented + 마지막 슬라이드 유지
all_presented → 명시적 restart → waiting + 공개 이력 초기화
```

참가자가 현재 Answer를 수정하는 동작은 PresentationItem을 자동 변경하지 않는다. 진행자가
그 Answer를 직접 재선택하면 최신 성공본으로 스냅샷을 갱신한다.
