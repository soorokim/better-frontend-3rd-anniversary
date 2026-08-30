# Implementation Plan: 대화 아바타 배포 준비

**Branch**: `codex/conversation-avatar` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-conversation-avatar-readiness/spec.md`

## Summary

로컬 작업 트리에만 남은 `003` 대화 아바타 구현을 먼저 누락 없는 커밋으로 고정한 뒤,
현재 운영 기준선인 `codex/mvp-core-flow` 위로 재배치한다. 기준선의 진행자 기능과
`0002_presenter_results`를 보존하고 대화 프로필 스키마는
`0003_conversation_profiles`로 다시 생성한다. 병합된 스키마와 마이그레이션 저널을
하나의 기준으로 검증해 새 설치와 기존 설치에서 같은 순서로 적용되게 한다.

가입·로그인·PIN 초기화는 활성 프로필의 정식 닉네임과 승인 별칭을 해석하는 공통
서버 함수를 사용한다. 가입은 출처·행사·정규화 닉네임별 차단 상태를 먼저 확인하고,
미승인 닉네임은 값싼 조회 뒤 실패 횟수만 기록한다. 승인 프로필은 가입 시도 슬롯을
원자적으로 확보한 요청에만 Argon2 PIN 해시를 허용한다. 공개 연출의 빠르게 바뀌는 후보는 보조기술 트리에서 제외하고,
별도 `role=status` 영역은 준비와 완료만 알린다. 마지막에는 통합 테스트, Playwright,
깨끗한 Compose 설치, `0002`가 적용된 기존 DB 갱신을 각각 검증하고 민감정보 없는
검증 기록을 남긴다.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 22 LTS, React 19.2; 기존 분석 CLI는 Python 3.11 이상

**Primary Dependencies**: Next.js 16.2 App Router, Drizzle ORM 0.44/Drizzle Kit 0.31,
PostgreSQL driver, Zod 4, `@node-rs/argon2`, DiceBear Core/Pixel Art, Docker Compose v2

**Storage**: PostgreSQL 17 named volume. `0001_event_core` → `0002_presenter_results` →
`0003_conversation_profiles`의 전진 마이그레이션을 사용한다. 대화 원문과 원본 사용자
식별자는 아카이브 LXC에만 남고 이번 구간에서 새로 저장하지 않는다.

**Testing**: Vitest 단위·PostgreSQL 통합 테스트, Testing Library 컴포넌트 테스트,
Playwright 브라우저/E2E, Python `unittest` 분석 회귀 테스트, Docker Compose 새 설치·업그레이드 스모크 테스트

**Target Platform**: Docker Compose v2를 실행하는 Linux 행사 서버, 최신 Chromium 계열
모바일·데스크톱 브라우저, 키보드 및 스크린리더 환경

**Project Type**: 서버 렌더링 UI와 Route Handler API를 함께 둔 단일 Next.js 웹 서비스

**Performance Goals**: 정상 가입의 95%가 2초 안에 완료되고, 움직임 축소 환경에서는
확정 프로필이 1초 안에 보인다. 한 출처의 반복 실패와 동시에 실행한 다른 정상 참가자
20명은 전원 가입을 완료한다.

**Constraints**: 현재 진행자·질문·답변 기능과 운영 데이터를 보존한다. 기존
`0002_presenter_results`를 수정하거나 이름을 바꾸지 않는다. 대화 아바타 변경은
`0003` 한 단계로 추가하고 운영 DB에서 down migration이나 volume 삭제를 사용하지 않는다.
PIN·초대 코드·세션·원문·원본 user ID는 로그와 검증 기록에 남기지 않는다. 전역 가입
차단을 추가하지 않고, 시각 셔플 문구를 live region에 넣지 않는다.

**Scale/Scope**: 행사 1개, 참가자 수십 명, 대화 메시지 약 46만 건에서 사전 생성된
프로필 배치 1개. 현재 로컬 변경 약 60개 경로와 메인 기준선 10개 커밋을 통합하며,
가입·로그인·PIN 복구·로비·관리자·진행자 대표 흐름을 검증한다.

## Constitution Check

*GATE: Phase 0 전 검토와 Phase 1 설계 후 재검토 완료.*

| 원칙 | 설계 대응 | 사전 | 설계 후 |
| --- | --- | --- | --- |
| I. 행사 경험 우선 | 별칭 PIN 복구와 진행자 회귀를 P1으로 두고 캐릭터 종류 확장은 제외한다. | PASS | PASS |
| II. 모바일과 접근성 기본 보장 | 360px·키보드·고대비·움직임 축소를 E2E로 확인하고 시각 후보와 `role=status`를 분리한다. | PASS | PASS |
| III. 기록의 보호와 데이터 지속성 | 기존 참가자·답변·발표 상태를 PostgreSQL에 유지하고 인증·원문을 로그나 산출물에 넣지 않는다. | PASS | PASS |
| IV. 재현 가능한 자체 호스팅 | `0003` 마이그레이션, 깨끗한 Git 후보, Compose 새 설치와 기존 DB 갱신 절차를 함께 검증한다. | PASS | PASS |
| V. 작고 복구 가능한 구현 | 기존 인증 제한 테이블과 프로필 저장소를 재사용하고 새 서비스·큐·실시간 채널을 추가하지 않는다. | PASS | PASS |

기술·운영 제약도 모두 통과한다. API 입력은 기존 Zod 경계를 유지하고, 인증 판정과
별칭 해석은 서버에서 수행한다. 새 DB 엔티티는 `003`에서 승인한 대화 프로필 구조뿐이며,
이번 구간에서 추가하는 가입 제한 상태는 기존 `auth_throttles` 행으로 표현한다.
운영 데이터 삭제는 구현이나 검증 절차에 포함하지 않는다.

## Integration Sequence

1. 현재 작업 트리의 수정·미추적 파일을 의도한 `003` 구현, `004` 명세·계획,
   로컬 전용 파일로 분류한다. 비밀값과 분석 원문이 없음을 검사하고 전달 대상 전체를
   커밋해 안전 기준점을 만든다.
2. `codex/mvp-core-flow`의 최신 커밋을 기준선으로 고정하고 대화 아바타 커밋을 그 위로
   재배치한다. 충돌은 `package.json`, 잠금 파일, `db/schema.ts`, 마이그레이션 저널,
   관리자 화면, 배포 문서를 중심으로 해결하며 양쪽 기능을 함께 보존한다.
3. 병합된 `db/schema.ts`에서 진행자 테이블과 대화 프로필 테이블을 모두 확인한 뒤,
   대화 프로필 변경을 `0003_conversation_profiles`와 저널 인덱스 2로 다시 생성한다.
   기존 `0001`, `0002` 파일은 수정하지 않는다.
4. 이름 해석, 가입 제한, 공개 연출 접근성을 고치고 계약·단위·통합 테스트를 맞춘다.
5. 정확한 커밋 SHA의 깨끗한 clone에서 새 설치와 기존 `0002` DB 갱신을 검증한다.
   lint, typecheck, build, 단위·분석·통합·E2E 및 운영 문서 점검이 모두 통과한 뒤에만
   배포 후보로 표시하고 upstream에 푸시한다.

## Project Structure

### Documentation (this feature)

```text
specs/004-conversation-avatar-readiness/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   └── deployment-validation.schema.json
├── checklists/
│   └── requirements.md
└── tasks.md                 # $speckit-tasks에서 생성
```

### Source Code (repository root)

```text
app/
├── (public)/join/page.tsx
├── (public)/login/page.tsx
├── (public)/reset-pin/page.tsx
├── (participant)/lobby/page.tsx
├── admin/
│   ├── page.tsx
│   └── presenter/
│       ├── page.tsx
│       └── screen/page.tsx
└── api/
    ├── participants/
    │   ├── register/route.ts
    │   ├── login/route.ts
    │   └── pin-reset/complete/route.ts
    └── admin/
        ├── avatar-profiles/route.ts
        └── presentation/
components/
├── avatar/
│   ├── AvatarReveal.tsx
│   ├── DeveloperIdentityCard.tsx
│   └── PixelAvatar.tsx
├── forms/
│   ├── ParticipantAuthForm.tsx
│   └── ResetPinForm.tsx
└── presenter/
lib/
├── auth/
│   ├── participant-service.ts
│   └── pin-reset-service.ts
├── db/repositories/
│   ├── conversation-profiles.ts
│   ├── participants.ts
│   └── presentation.ts
├── presentation/
└── security/rate-limit.ts
db/
├── schema.ts
└── migrations/
    ├── 0001_event_core.sql
    ├── 0002_presenter_results.sql
    ├── 0003_conversation_profiles.sql
    └── meta/_journal.json
scripts/
├── deploy.sh
├── backup.ps1
├── restore.ps1
├── import-conversation-profiles.ts
└── validate-conversation-profiles.ts
tests/
├── unit/
├── integration/
├── e2e/
└── fixtures/avatar-analysis/
```

**Structure Decision**: 현재 Next.js 단일 프로젝트 구조를 유지한다. 이름 해석은 대화
프로필 저장소와 인증 서비스 사이의 공통 서버 경계에 두고, 가입 제한은 기존
`auth_throttles` 저장소를 확장한다. 진행자 기능은 기준선의 디렉터리와 서비스 구조를
그대로 보존하며, 확정 대화 아바타의 일반 `traits` 스냅샷만 기존 발표 흐름에 통과시킨다.
배포 검증 기록은 운영 DB 테이블이 아니라 계약 스키마를 따르는 민감정보 없는 CI/문서
산출물로 남긴다.

## Complexity Tracking

헌법 위반이나 별도 예외 승인이 필요한 복잡성은 없다.
