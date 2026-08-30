# Implementation Plan: 진행자 결과 발표 화면

**Branch**: `002-presenter-results` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-presenter-results/spec.md`

**Note**: 기존 참가자 답변과 관리자 인증 위에 행사 진행 상태만 추가한다. 질문 관리,
답변 편집·삭제, 투표와 공개 아카이브는 이 계획에 포함하지 않는다.

## Summary

관리자가 현재 질문의 제출 현황과 답변 전문을 확인하고, 특정 답변 또는 아직 공개하지 않은
답변을 골라 익명으로 한 장씩 발표할 수 있게 한다. 별도 발표 화면은 현재 공개된 스냅샷만
받으며, 진행자가 명시적으로 공개하기 전에는 작성자 정보를 응답 자체에 포함하지 않는다.

발표 상태는 PostgreSQL의 질문별 세션과 실제로 공개한 답변 항목으로 나누어 저장한다.
답변을 고르는 트랜잭션이 원본 답변·닉네임·현재 캐릭터를 함께 스냅샷으로 잡고 진행 순서와
revision을 갱신한다. 진행자와 발표 화면은 관리자 권한으로 2초마다 각자 필요한 상태만
조회한다. 이 방식이면 별도 실시간 서버 없이도 5초 반영 목표와 새로고침·재배포 복구를
같이 만족한다.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 22.13 이상

**Primary Dependencies**: Next.js 16.2 App Router, React 19.2, Drizzle ORM 0.44,
PostgreSQL driver, Zod 4, 기존 픽셀 아바타 표시 계층

**Storage**: PostgreSQL 17 단일 인스턴스와 영구 Docker volume. 질문별 발표 세션 1행과
공개된 답변별 발표 항목을 추가한다.

**Testing**: Vitest 단위·통합 테스트, Testing Library 컴포넌트 테스트, Playwright
데스크톱·다중 페이지 종단 테스트, 실제 PostgreSQL 트랜잭션·동시성 테스트

**Target Platform**: Docker Engine과 Compose를 실행하는 Linux 서버, 최신 데스크톱
브라우저와 1,366×768 이상 프로젝터 화면

**Project Type**: 화면, 서버 인터페이스와 데이터 접근을 한 저장소에서 제공하는 단일 웹
애플리케이션

**Performance Goals**: 진행자 변경과 새 제출이 정상 연결에서 5초 안에 진행자·발표 화면에
반영되고, 답변 30개 무작위 공개에서 중복이나 순서 손실이 없어야 한다.

**Constraints**: 관리자 세션과 CSRF 검증 재사용, 민감 응답 캐시 금지, 익명 상태에서 작성자
필드 전송 금지, 브라우저 저장소를 기준 데이터로 사용하지 않음, 별도 WebSocket·메시지
브로커·공개 화면 토큰 없음, 원본 답변 불변

**Scale/Scope**: 행사 1개, 공개 질문 1개, 주 진행자 1명과 보조 창, 참가자·답변 최대 30개,
관리자 화면 2개, 조회 계약 2개와 상태 변경 계약 1개

## Constitution Check

*GATE: Phase 0 전 검토 및 Phase 1 설계 후 재검토 완료.*

| 원칙 | 설계 대응 | 결과 |
|------|-----------|------|
| 행사 경험 우선 | 현황 확인→익명 공개→작성자 공개→다음 답변이라는 행사 진행 흐름만 추가한다. | PASS |
| 모바일과 접근성 | 참가자 흐름은 바꾸지 않는다. 진행자 동작은 키보드와 보이는 포커스를 제공하고 발표 화면은 긴 한글을 읽기 쉽게 표시한다. | PASS |
| 기록 보호와 지속성 | 모든 조회·변경에서 관리자 권한을 검사하고, 발표 상태와 스냅샷은 영구 저장하며 익명 화면에는 작성자 필드를 보내지 않는다. | PASS |
| 재현 가능한 자체 호스팅 | 기존 Compose와 PostgreSQL 안에 마이그레이션을 추가하고 별도 외부 서비스는 도입하지 않는다. | PASS |
| 작고 복구 가능한 구현 | 2초 정기 조회와 2개 테이블로 제한하며, 명시적 발표 초기화 외에는 데이터를 지우지 않는다. | PASS |

Phase 1 설계 후에도 위반 사항은 없다. 답변 스냅샷은 발표 중 참가자 수정으로 문구가 갑자기
바뀌는 일을 막고 이전·다음 및 재시작 복구를 제공하기 위한 현재 요구사항이다. 질문별 행 잠금은
동시 무작위 선택의 중복과 순서 충돌을 막는 최소 동시성 경계다.

## Project Structure

### Documentation (this feature)

```text
specs/002-presenter-results/
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
├── admin/
│   ├── page.tsx
│   └── presenter/
│       ├── page.tsx
│       └── screen/page.tsx
└── api/admin/presentation/
    ├── route.ts
    ├── screen/route.ts
    └── commands/route.ts
components/admin/presenter/
├── PresenterController.tsx
├── PresenterSummary.tsx
├── AnswerQueue.tsx
└── PresentationScreen.tsx
lib/
├── presentation/
│   ├── presentation-service.ts
│   └── presentation-view.ts
├── db/repositories/presentation.ts
├── validation/presentation.ts
└── observability/logger.ts
db/
├── schema.ts
└── migrations/
tests/
├── unit/presentation-state.test.ts
├── unit/presentation-view.test.ts
├── integration/presentation-api.test.ts
├── integration/presentation-concurrency.test.ts
└── e2e/presenter-results.spec.ts
```

**Structure Decision**: 기존 Next.js 단일 프로젝트를 유지한다. 관리자 페이지와 계약은 기존
`app/admin`, `app/api/admin` 아래에 두고, 트랜잭션과 화면별 DTO 조립은 `lib/presentation`과
전용 repository로 분리한다. 참가자 답변 저장 경로와 기존 관리자 참가자·PIN 복구 경로는
수정 범위를 최소화하고 회귀 테스트만 추가한다.

## Complexity Tracking

헌법 위반이나 별도 예외 승인이 필요한 복잡성은 없다.
