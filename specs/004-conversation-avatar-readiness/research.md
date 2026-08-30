# Phase 0 Research: 대화 아바타 배포 준비

## 1. 로컬 변경을 잃지 않고 기준선 위로 옮기기

**Decision**: 재배치 전에 수정·미추적 파일을 모두 분류하고 비밀값 검사를 거친 뒤,
전달 대상 전체를 하나 이상의 복구 가능한 커밋으로 만든다. 그 커밋을 현재 운영 기준선
`codex/mvp-core-flow` 위로 rebase하고, 마지막에 `git status --porcelain=v1
--untracked-files=all`이 비어 있는 정확한 커밋을 배포 후보로 쓴다.

**Rationale**: 현재 브랜치는 기준선보다 10커밋 뒤이고 실제 아바타 구현은 커밋되지 않은
작업 트리에만 있다. Git rebase는 커밋을 새 기준점 위에서 다시 적용하는 작업이라서,
미추적 파일을 포함한 현재 상태를 먼저 커밋으로 고정해야 되돌리거나 충돌을 검토할 수 있다.
Porcelain status는 자동화에서 안정적으로 추적·미추적 파일을 검사할 수 있다.

**Alternatives considered**:

- 더러운 작업 트리에서 바로 rebase: 미추적 파일이 누락되고 충돌 복구 기준이 불명확하다.
- 기준선을 대화 아바타 브랜치로 merge: 가능하지만 아직 공유되지 않은 선형 기능 브랜치라
  충돌 해결 커밋과 실제 기능 변경을 구분하기 어렵다.
- 파일을 수동 복사해 새 브랜치에서 다시 만들기: 구현과 테스트의 누락 여부를 증명하기 어렵다.

**Sources**:

- https://git-scm.com/docs/git-rebase
- https://git-scm.com/docs/git-status

## 2. 마이그레이션 순서와 `participant_register` enum

**Decision**: `0001_event_core`와 이미 배포 기준선에 있는 `0002_presenter_results`는
그대로 보존한다. 병합된 최종 `db/schema.ts`에서 대화 프로필 테이블, 아바타 연결 필드,
고유 인덱스, `throttle_action`의 `participant_register` 값을 포함하는
`0003_conversation_profiles`를 새로 생성하고 저널 인덱스를 2로 둔다. 새 enum 값은
마이그레이션에서 추가만 하고 같은 마이그레이션 SQL 안에서 그 값을 사용하는 데이터 행은
삽입하지 않는다.

**Rationale**: 서로 다른 두 `0002`는 적용 순서와 Drizzle 저널을 모호하게 만든다.
PostgreSQL은 transaction block 안에서 `ALTER TYPE ... ADD VALUE`로 넣은 enum 값을
commit 전 사용할 수 없으므로, 이 단계는 스키마 변경만 담당하고 가입 제한 행은 실제
요청에서 마이그레이션 완료 뒤 생성하는 편이 안전하다.

**Alternatives considered**:

- 진행자 마이그레이션을 `0003`으로 바꾸기: 이미 기준선과 기존 서버에 적용된 이름을
  바꾸게 되어 운영 이력을 깨뜨린다.
- 가입 제한에 기존 `invite` action 재사용: 초대 코드 성공 시 제한이 지워지고,
  초대 검증과 비싼 PIN 해시 보호가 서로 영향을 준다.
- 새 가입 제한 테이블 추가: 기존 `auth_throttles`가 필요한 상태와 고유성을 이미 제공한다.

**Sources**:

- https://www.postgresql.org/docs/17/sql-altertype.html

## 3. 정식 닉네임과 승인 별칭의 공통 해석

**Decision**: 정규화된 이름 키를 받아 활성 대화 프로필과 선점 참가자를 해석하는 공통
서버 함수를 둔다. 결과는 `resolved`, `not_found`, `ambiguous`로 구분한다. 로그인과 PIN
초기화는 이 함수가 반환한 참가자 ID를 사용하고, 가입은 같은 활성 별칭 규칙으로 프로필을
찾아 트랜잭션 안에서 선점한다. 직접 참가자 닉네임 조회와 별칭 조회가 서로 다른 참가자를
가리키면 자동 선택하지 않고 `ambiguous`로 처리한다.

**Rationale**: 현재 로그인은 별칭을 따라가지만 PIN 초기화는 `participants.nickname_key`만
조회한다. 공통 해석 결과를 참가자 ID로 고정하면 인증 흐름마다 조회 규칙이 갈라지지 않고,
PIN 변경 뒤에도 participant·answer·avatar foreign key는 그대로 유지된다.

**Alternatives considered**:

- PIN 초기화에만 별칭 조회를 복사: 다음 인증 흐름이 추가될 때 다시 차이가 생긴다.
- 참가자 테이블에 모든 별칭을 복제: 활성 배치 전환 때 두 기준 데이터를 동기화해야 한다.
- 충돌 시 첫 행 선택: 잘못된 계정 PIN을 바꿀 수 있다.

## 4. 비싼 PIN 해시 전 가입 시도 제한

**Decision**: 가입 subject는 `event ID + normalized nickname key + client IP`를 기존 HMAC
digest로 만든다. 초대와 활성 배치를 검증한 뒤 먼저 subject의 차단 상태를 읽는다. 차단되지
않은 요청은 승인 프로필 존재·선점 여부를 값싼 DB 조회로 확인하고, 미승인 닉네임은 Argon2
없이 실패 횟수만 원자적으로 올린다. 승인된 미선점 프로필은 Argon2 해시를 시작하기 직전에
같은 `participant_register` 시도 슬롯을 원자적으로 소비한다. 한도에 도달한 두 경로 모두
429, `Retry-After`, `retryAfterSeconds`를 돌려주며 성공한 가입만 해당 subject를 지운다.
프로필 조회와 참가자 생성은 최종 트랜잭션에서 다시 확인해 동시 가입을 막는다.

**Rationale**: 실패 뒤에만 카운트를 올리면 같은 출처가 병렬 요청을 보내는 동안 여러
Argon2 작업이 이미 시작될 수 있다. 비싼 경계 직전 슬롯을 원자적으로 소비하면 한 subject의
비용을 제한할 수 있고, 닉네임도 key에 넣으므로 같은 NAT의 다른 정상 참가자는 막히지 않는다.
미승인 닉네임은 같은 이름을 반복할 때 제한되지만 해시를 실행하지 않는다. 무작위 이름 회전은
값싼 조회와 실패 기록까지만 수행하므로 CPU 자원 고갈 경로가 되지 않는다.

**Alternatives considered**:

- IP만으로 제한: 행사장 공유 Wi-Fi에서 참가자 전체가 같이 막힌다.
- 닉네임만으로 제한: 여러 출처가 한 참가자의 가입을 쉽게 잠글 수 있다.
- PIN 해시 후 실패 기록: 보호하려는 CPU 작업을 먼저 실행하므로 목적에 맞지 않는다.
- 앱 메모리 카운터: 재시작·다중 인스턴스에서 제한이 사라지거나 갈라진다.

## 5. 공개 연출의 보조기술 상태 모델

**Decision**: 빠르게 변하는 후보·터미널 문구는 시각 장식 컨테이너에 두고
`aria-hidden=true`로 보조기술에서 제외한다. 별도 `role=status aria-atomic=true` 영역은
연출 시작의 짧은 문구와 확정 완료 문구만 최대 한 번씩 갱신한다. 셔플 중에는 임시
개발자 카드를 키보드 상호작용 대상으로 노출하지 않고 확정 뒤에만 버튼을 활성화한다.
컴포넌트는 첫 effect에서 `matchMedia('(prefers-reduced-motion: reduce)')`를 확인해
축소 환경에서는 interval을 만들지 않고 정적 준비 상태에서 확정 결과로 바로 전환한다.

**Rationale**: `role=status`는 암시적으로 polite live region이며 atomic 상태이므로,
후보 세 줄 전체를 360ms마다 넣으면 보조기술이 계속 읽을 수 있다. 상태와 장식을 분리하면
시각 연출은 유지하면서 실제 안내 횟수를 통제할 수 있다. Playwright는 reduced motion을
에뮬레이션할 수 있어 interval 부재와 1초 내 확정을 자동 검증할 수 있다.

**Alternatives considered**:

- 현재 컨테이너에 `aria-live=off`: 준비와 완료도 전달되지 않는다.
- 셔플 주기만 늦추기: 장식용 후보가 여전히 핵심 상태처럼 읽힌다.
- 움직임 축소에서 CSS만 0초로 만들기: JavaScript의 후보 상태 변경과 live-region 갱신은 남을 수 있다.

**Sources**:

- https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22.html
- https://playwright.dev/docs/api/class-browsertype

## 6. 기준선 진행자 기능과 아바타의 통합

**Decision**: 진행자 테이블·API·화면은 기준선 구현을 보존한다. 발표 항목은 이미
`generatorVersion`, `catalogVersion`, 일반 `traits`를 스냅샷으로 저장하므로 대화 아바타를
위한 별도 발표 스키마를 추가하지 않는다. 대신 대화 아바타 참가자의 답변을 선택하고
작성자를 공개했을 때 같은 확정 traits가 진행자와 프로젝터에 나오는 통합·E2E 회귀
테스트를 추가한다.

**Rationale**: 저장 형식이 아바타 원천 종류에 종속되지 않아 현재 계약으로 요구사항을
충족한다. 별도 컬럼이나 변환 테이블은 실제 필요 없이 마이그레이션 위험만 늘린다.

**Alternatives considered**:

- 발표 항목에 conversation profile ID 추가: 발표 스냅샷의 독립성과 과거 재현성을 깨뜨린다.
- 진행자 기능을 대화 아바타 구현 버전으로 덮어쓰기: 이미 검증된 현재 기준선 기능이 사라진다.

## 7. 새 설치와 기존 서버 갱신 검증

**Decision**: 정확한 후보 commit을 새로 clone하고 고유 Compose project name을 써서
서로 격리된 환경을 만든다. 새 설치는 빈 volume에서 `0001→0002→0003`을 세 번 검증한다.
업그레이드는 기준선 commit으로 `0001→0002`를 적용하고 대표 참가자·답변·발표 상태를
만든 뒤 후보 commit의 `0003`을 적용하는 흐름을 세 번 검증한다. 매 회 적용 전 custom-format
백업과 `pg_restore --list` 검사를 남기며, 적용 후 기존 행 수·발표 상태·대화 프로필 import와
대표 UI를 비교한다.

**Rationale**: Compose project name은 같은 호스트에서도 컨테이너와 volume을 격리한다.
깨끗한 clone은 로컬 미추적 파일 의존성을 드러내고, 기존 기준선 DB 갱신은 단순 빈 DB
테스트가 찾지 못하는 순서·호환성 문제를 드러낸다.

**Alternatives considered**:

- 현재 더러운 worktree의 개발 서버만 확인: 커밋 누락과 설치 문서 문제를 발견하지 못한다.
- 운영 서버에서 처음 migration 검증: 실패가 실제 행사 데이터에 바로 영향을 준다.
- migration을 여러 번 같은 DB에서만 재실행: idempotency는 확인하지만 새 설치와 upgrade
  경로의 차이를 검증하지 못한다.

**Sources**:

- https://docs.docker.com/compose/how-tos/project-name/

## 8. 검증 기록과 배포 게이트

**Decision**: 검증 회차마다 후보 SHA, 기준선 SHA, 환경 종류, 마이그레이션 전후 tag,
테스트 결과, 데이터 보존 카운트, 접근성 확인, 시작·종료 시각을 JSON 계약에 맞춰 남긴다.
닉네임, IP, PIN, 초대 코드, 세션, 답변 전문, 대화 원문은 금지한다. 세 번의 clean/upgrade
기록과 전체 자동화가 통과하고 Git 상태가 깨끗할 때만 release-ready로 판단한다.

**Rationale**: “검증했다”는 문장만으로는 어느 commit과 DB 경로를 확인했는지 알 수 없다.
작은 구조화 기록이면 재현성과 개인정보 경계를 함께 지킬 수 있고 운영 DB 테이블을
추가할 필요도 없다.

**Alternatives considered**:

- 콘솔 로그만 보관: 비밀값이 섞일 수 있고 필수 시나리오 누락을 자동 검사하기 어렵다.
- 운영 DB에 검증 테이블 추가: 제품 기능과 무관한 마이그레이션을 더 만든다.
