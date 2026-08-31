# Data Model: 질문별 답변 공개 진행

## 공통 규칙

- Event, Participant, Answer와 AvatarAssignment는 기존 기준 데이터다. 원본 Answer는 발표 중 수정·삭제하지 않는다.
- 한 행사는 순서가 고정된 질문 네 개와 행사 진행 상태 한 개를 가진다.
- 모든 상태 변경은 관리자 행사 경계 안에서 처리하며, 답변·닉네임·아바타 스냅샷은 진단 로그에 남기지 않는다.
- 시간은 UTC로 저장하고 화면에서 행사 시간대로 표시한다.

## Existing Entity: Question (extended)

| Field | Type | Rules |
|------|------|-------|
| id | UUID | Primary key |
| event_id | UUID | Event foreign key |
| prompt | text | 1~500자 |
| display_order | integer | 1~4, 행사 안에서 유일 |
| status | draft / published / closed | 행사 전 답변 가능 여부를 나타냄; published는 최대 네 건 |
| published_at | timestamp nullable | 참가자 답변을 연 시각 |

**Relationship**: Event 1:4 Questions, Question 1:0..1 PresentationSession

## Entity: QuestionSequenceSession

행사 전체의 현재 질문과 질답 완료 상태를 보관한다.

| Field | Type | Rules |
|------|------|-------|
| id | UUID | Primary key |
| event_id | UUID | Unique; Event foreign key |
| current_question_id | UUID nullable | 현재 발표 중인 Question; 전체 완료면 null |
| status | waiting / in_progress / completed | 행사 진행 단계 |
| revision | integer | 0 이상; 성공한 변경마다 증가 |
| completed_at | timestamp nullable | 네 번째 질문을 끝낸 시각 |
| updated_at | timestamp | 최근 변경 시각 |

**State transitions**:

```text
waiting --start_question--> in_progress
in_progress --advance_question (다음 질문 있음)--> in_progress
in_progress --advance_question (마지막 질문 완료)--> completed
completed --review_question--> completed   # 전체 진행 포인터는 되돌리지 않음
```

## Existing Entity: PresentationSession (extended use)

질문 한 건의 현재 발표 항목과 질문별 revision을 보관한다. 각 질문은 한 개의 세션만 가진다.
현재 항목은 `presenting`인 답변을 가리킬 때만 다음 답변·질문 전환의 게이트가 된다.

## Existing Entity: PresentationItem (extended)

원본 답변을 발표 중에 쓸 스냅샷과 완료 상태를 보관한다.

| Field | Type | Rules |
|------|------|-------|
| presentation_session_id | UUID | Question session foreign key |
| answer_id | UUID | Session 안에서 유일 |
| content/nickname/avatar snapshot | existing fields | 원본 변경으로 현재 발표가 바뀌지 않음 |
| presentation_order | integer | 질문 안에서 유일, 1 이상 |
| completion_state | presenting / revealed / excluded | 새 선택은 presenting |
| completed_at | timestamp nullable | revealed 또는 excluded일 때만 값 존재 |
| exclusion_note | text nullable | 짧은 운영 사유, 발표 화면에 노출하지 않음 |

**Completion rule**: 질문의 모든 제출 답변은 PresentationItem이 있고 `revealed` 또는 `excluded`여야 완료다. 답변이 0개인 질문은 빈 상태 확인 뒤 완료로 전환할 수 있다.

## Read Models

- **Controller view**: 네 질문의 순서·상태, 현재 질문, 현재 답변, 질문별 제출·완료·남은 수, 진행자가 확인할 작성자 정보를 포함한다.
- **Screen view**: 현재 시작된 질문과 현재 답변만 포함한다. 답변이 `presenting`이면 작성자를 보내지 않고, `revealed`일 때만 작성자를 포함한다. locked 질문과 미공개 후보는 포함하지 않는다.
- **Participant archive view**: 행사 진행 상태가 `completed`일 때만 질문 순서와 공개 답변·작성자 스냅샷을 포함한다. 로그인한 참가자에게만 반환한다.

## Transaction Boundaries

| Command | Locked rows | Must hold before write |
|---------|-------------|------------------------|
| start_question | QuestionSequenceSession | waiting 상태와 첫 질문 존재 |
| reveal_next_answer | QuestionSequenceSession, current PresentationSession | 현재 항목 없음 또는 완료; 미완료 후보 존재 |
| reveal_author | QuestionSequenceSession, current PresentationSession, item | 현재 항목이 presenting |
| exclude_current_answer | QuestionSequenceSession, current PresentationSession, item | 현재 항목이 presenting, confirmed true |
| advance_question | QuestionSequenceSession, current PresentationSession | 현재 질문이 빈 질문이거나 모든 답변 완료 |
| review_question | QuestionSequenceSession, requested PresentationSession | requested question is completed; 전체 순서는 변경하지 않음 |
