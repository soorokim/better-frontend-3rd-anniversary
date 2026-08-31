# Implementation Plan: 질문별 답변 공개 진행

**Branch**: `003-question-answer-sequence` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-question-answer-sequence/spec.md`

## Summary

기존 단일 질문 답변·발표 기능을 네 개의 고정 질문을 행사 전에 모두 작성하고, 행사에서 순서대로 여는 질답 진행으로 확장한다.
진행자는 현재 질문을 시작하고, 답변 하나를 먼저 보여 준 뒤 작성자를 공개한다. 현재 질문의
답변을 모두 작성자 공개 또는 명시적 제외 처리해야만 다음 질문을 시작할 수 있다.

질문은 행사 초기화 때 네 개를 모두 답변 가능 상태로 영구 저장하고, 행사별 `question_sequence_sessions`가 현재
질문과 완료 여부, revision을 관리한다. 기존 `presentation_sessions`와 `presentation_items`는
질문별 답변 스냅샷과 발표 이력으로 계속 사용하되, 항목에 완료·제외 상태를 추가한다. 상태
변경은 행사 진행 행과 현재 질문 발표 세션을 같은 트랜잭션에서 잠가 처리한다. 진행자와
프로젝터는 기존 2초 정기 조회와 분리된 DTO를 그대로 사용한다. 전체 완료 뒤에는 로그인한
참가자에게만 질문별 공개 답변·작성자를 보여 주는 기록 화면을 제공한다.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 22.13 이상

**Primary Dependencies**: Next.js 16.2 App Router, React 19.2, Drizzle ORM 0.44,
PostgreSQL driver, Zod 4, 기존 픽셀 아바타 표시 계층

**Storage**: PostgreSQL 17과 영구 Docker volume. 기존 질문·답변·발표 테이블에 행사별
질답 진행 상태와 답변 발표 완료 상태를 추가하고, 원본 답변 스냅샷을 완료 후 기록 열람에 재사용한다.

**Testing**: Vitest 단위·통합 테스트, Testing Library 컴포넌트 테스트, Playwright의 진행자와
프로젝터 다중 페이지 E2E, 실제 PostgreSQL 트랜잭션·동시성 테스트

**Target Platform**: Docker Engine과 Compose를 실행하는 Linux 서버, 최신 데스크톱 브라우저와
1,366×768 이상 프로젝터 화면. 참가자 답변 화면은 기존 모바일 지원을 유지한다.

**Project Type**: 화면, 서버 인터페이스와 데이터 접근을 한 저장소에서 제공하는 단일 웹 애플리케이션

**Performance Goals**: 정상 연결에서 진행자 명령과 질문 전환이 5초 안에 두 화면에 반영되고,
질문당 최대 30개 답변이 순서 누락 없이 완료 상태로 기록된다.

**Constraints**: 관리자 세션·Origin·CSRF 검증 재사용, 민감 응답 캐시 금지, 익명 응답에서
작성자 필드 전송 금지, 완료 전 참가자에게 다른 사람 답변을 전송하지 않음, 완료 후 기록은
로그인한 참가자에게만 전송, 브라우저 저장소를 기준 데이터로 사용하지 않음, WebSocket·메시지
브로커·공개 화면 토큰을 추가하지 않음, 원본 답변은 불변

**Scale/Scope**: 행사 1개, 고정 질문 4개, 질문당 최대 30개 답변, 주 진행자 1명과 보조 창,
관리자·프로젝터 조회 계약 및 단일 명령 계약 확장

## Constitution Check

*GATE: Phase 0 전 검토 및 Phase 1 설계 후 재검토 완료.*

| 원칙 | 설계 대응 | 결과 |
|------|-----------|------|
| 행사 경험 우선 | 질문→답변→작성자→다음 질문의 실제 진행만 다루며 투표와 게임은 넣지 않는다. | PASS |
| 모바일과 접근성 | 참가자는 행사 전에 휴대폰에서 네 질문을 작성하고, 완료 후 기록을 읽을 수 있다. 진행자 조작은 키보드와 포커스를 제공하고 프로젝터는 긴 한글을 읽기 쉽게 표시한다. | PASS |
| 기록 보호와 지속성 | 완료 전 답변 조회는 관리자만, 완료 후 기록 조회는 로그인한 참가자만 허용한다. 질문 위치와 공개 이력은 PostgreSQL에 보존하고 익명 DTO에는 작성자 필드 자체를 넣지 않는다. | PASS |
| 재현 가능한 자체 호스팅 | 기존 Compose·PostgreSQL·마이그레이션 체계 안에서 끝내며 외부 서비스나 별도 서버를 추가하지 않는다. | PASS |
| 작고 복구 가능한 구현 | 행사 진행 행 1개, 질문별 기존 발표 세션, 상태 값 추가만 사용한다. 전환은 명령 allowlist와 행 잠금으로 복구 가능하게 제한한다. | PASS |

Phase 1 뒤에도 위반 사항은 없다. 행사 진행 행은 네 질문의 순서를 DB 트랜잭션으로 보장하고,
발표 항목의 완료·제외 상태는 작성자 공개 전에 다음 단계로 넘어가지 못하게 하려는 현재 요구에
필요한 최소 상태다.

## Project Structure

### Documentation (this feature)

```text
specs/003-question-answer-sequence/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md                 # $speckit-tasks에서 생성
```

### Source Code (repository root)

```text
app/
├── api/questions/route.ts
├── api/answers/archive/route.ts
├── api/admin/presentation/
│   ├── route.ts
│   ├── screen/route.ts
│   └── commands/route.ts
├── (participant)/memory/page.tsx
├── (participant)/answers/page.tsx
└── admin/presenter/
    ├── page.tsx
    └── screen/page.tsx
components/admin/presenter/
├── PresenterController.tsx
├── PresenterSummary.tsx
├── AnswerQueue.tsx
├── PresentationScreen.tsx
└── usePresentationPolling.ts
lib/
├── questions/question-service.ts
├── answers/archive-service.ts
├── presentation/presentation-service.ts
├── presentation/presentation-view.ts
├── db/repositories/questions.ts
├── db/repositories/presentation.ts
└── validation/presentation.ts
db/
├── schema.ts
├── migrations/
└── seed.ts
tests/
├── unit/presentation-state.test.ts
├── unit/presentation-view.test.ts
├── integration/presentation-api.test.ts
├── integration/presentation-concurrency.test.ts
└── e2e/presenter-results.spec.ts
```

**Structure Decision**: 기존 Next.js 단일 프로젝트를 유지한다. 질문 순서·발표 상태 규칙은
`lib/presentation`과 전용 repository에 두며, 참가자 답변 작성은 네 질문을 한 번에 받는다.
완료 후 기록 조회는 참가자 인증을 확인하는 별도 읽기 전용 route와 화면으로 분리한다.

## Complexity Tracking

헌법 위반이나 별도 예외 승인이 필요한 복잡성은 없다.
