# Implementation Plan: 3주년 행사 기본 참여 흐름

**Branch**: `001-event-core-flow` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-event-core-flow/spec.md`

**Note**: 이 문서는 1차 구현만 다룬다. 미니게임, 대화 분석, 답변 공개와 엔딩은 후속
기능 명세에서 결정한다.

## Summary

초대 코드로 제한된 소규모 행사 웹앱에서 참가자가 닉네임과 6자리 PIN을 등록하고,
결정적으로 생성된 픽셀 캐릭터와 함께 로비에 들어가 3주년 질문 하나에 답하도록 만든다.
진행자는 별도 인증 뒤 참가자별 제출 상태를 보고 일회용 코드로 PIN 초기화를 돕는다.

기술적으로는 현재 Cloudflare Sites용 초기 틀을 표준 Next.js 단일 애플리케이션으로
정리하고, 모든 상태를 PostgreSQL에 저장한다. Docker Compose가 데이터베이스 마이그레이션,
애플리케이션, 선택 가능한 Caddy HTTPS 프록시를 함께 실행한다. 참가자와 관리자 인증은
서버 저장형 불투명 세션을 사용하며, 아바타 배정은 참가자 및 답변과 분리해 이후 대화 기반
입력으로 교체할 수 있게 한다.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 22 LTS

**Primary Dependencies**: Next.js 16.2 App Router, React 19.2, Tailwind CSS 4,
Drizzle ORM, PostgreSQL driver, Zod, Argon2id 구현체

**Storage**: PostgreSQL 17 단일 인스턴스와 영구 Docker volume

**Testing**: Vitest 단위·통합 테스트, Testing Library 컴포넌트 테스트,
Playwright 모바일·브라우저 종단 테스트, 실제 PostgreSQL 계약 테스트

**Target Platform**: Docker Engine과 Compose를 실행할 수 있는 Linux 서버, 최신 모바일·데스크톱 브라우저

**Project Type**: 서버 렌더링과 서버 인터페이스를 한 저장소에서 제공하는 단일 웹 애플리케이션

**Performance Goals**: 정상 네트워크에서 주요 화면 전환과 저장 결과의 95%가 2초 안에 표시되고,
30명이 5분 동안 등록과 답변 저장을 겹쳐 수행해도 기록 손실이 없어야 한다.

**Constraints**: 360픽셀 너비와 키보드 조작 지원, HTTPS 전용 운영, 브라우저 저장소를
기준 데이터로 사용하지 않음, 이미지 업로드·WebSocket·외부 인증 서비스 없음

**Scale/Scope**: 행사 1개, 진행자 1명, 참가자 최대 30명, 질문 1개, 참가자 화면 5개와
관리자 화면 2개, 인증·답변·관리용 서버 인터페이스 약 11개

## Constitution Check

*GATE: Phase 0 전 검토 및 Phase 1 설계 후 재검토 완료.*

| 원칙 | 설계 대응 | 결과 |
|------|-----------|------|
| 행사 경험 우선 | 입장→캐릭터→답변→관리자 복구의 한 개 수직 흐름만 구현한다. | PASS |
| 모바일과 접근성 | 360px, 터치, 키보드, 명확한 상태 문구를 종단 검증에 포함한다. | PASS |
| 기록 보호와 지속성 | 서버 권한 검사, 해시된 인증값, 서버 세션, PostgreSQL 영구 저장을 사용한다. | PASS |
| 재현 가능한 자체 호스팅 | Compose, 마이그레이션 전용 작업, `.env.example`, secrets, 백업 절차를 제공한다. | PASS |
| 작고 복구 가능한 구현 | 업로드·소켓·다중 서비스는 제외하고 PIN 초기화와 실패 복구를 관리자 흐름에 포함한다. | PASS |

설계 후 재검토에서도 위반 사항이 없다. 아바타 이력과 PIN 초기화 기록은 각각 기존 답변
보존과 현장 복구라는 현재 요구사항 때문에 필요한 최소 데이터다.

## Project Structure

### Documentation (this feature)

```text
specs/001-event-core-flow/
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
├── (public)/
│   ├── page.tsx
│   ├── join/page.tsx
│   └── login/page.tsx
├── (participant)/
│   ├── lobby/page.tsx
│   └── memory/page.tsx
├── admin/
│   ├── login/page.tsx
│   └── page.tsx
└── api/
    ├── participants/
    ├── me/
    ├── question/
    ├── answer/
    ├── admin/
    └── health/
components/
├── game-ui/
├── forms/
└── avatar/
lib/
├── auth/
├── avatar/
├── db/
├── security/
└── validation/
db/
├── schema.ts
└── migrations/
public/
└── avatar-parts/
tests/
├── unit/
├── integration/
└── e2e/
Dockerfile
compose.yaml
Caddyfile
.env.example
```

**Structure Decision**: 프런트와 서버를 별도 프로젝트로 나누지 않고 Next.js App Router
한 프로젝트에 둔다. 인증과 데이터 접근은 `lib/`의 서버 전용 모듈로 모으며, 공개 서버
계약은 `app/api/`에서만 노출한다. 현재 `.openai/hosting.json`, `vite.config.ts`, vinext와
Cloudflare 전용 패키지는 자체 호스팅 목표와 맞지 않으므로 구현 첫 작업에서 제거한다.

## Complexity Tracking

헌법 위반이나 별도 예외 승인이 필요한 복잡성은 없다.
