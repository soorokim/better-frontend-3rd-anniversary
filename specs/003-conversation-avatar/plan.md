# Implementation Plan: 대화 기반 개발자 아바타

**Branch**: `codex/conversation-avatar` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-conversation-avatar/spec.md`

## Summary

카카오 아카이브의 비시스템 사용자 중 메시지가 하나 이상인 모든 사람을
행사 전에 개인별로 분석한다. 알려진 별칭 목록은 운영자가 승인한 닉네임 변경 이력만
한 사람으로 합치는 데 쓰고, 목록에 없는 고유 닉네임 참여자도 자동으로 모두 포함한다.
같은 정규화 닉네임의 원본 사용자 행이 둘 이상이면 자동 병합하지 않고 별도 검토
목록을 만들어 사용자의 승인을 받은 뒤 전체 분석을 다시 실행한다. 분석은 아카이브
컨테이너 안에서 읽기 전용으로 돌리고, 대화 원문 대신 요약 통계·후보 목록·HMAC
표식자만 행사 서비스로 옮긴다.

전체 산출물은 스키마, 원본 행 포함 여부, 별칭 충돌, 중복 닉네임을 먼저 검증하고 하나의
트랜잭션으로 가져온다. 성공한 배치의 프로필과 별칭만 가입 허용 목록이 된다.
원본 사용자 행 수와 프로필 수는 별칭 병합 때문에 달라도 되며, 각 프로필에는 병합된
원본 별칭과 원본 행 개수만 남긴다. 카카오 user ID와 충돌 검토 목록은 아카이브 환경과
Git에 포함되지 않는 서버 전용 승인 파일에서만 사용한다. 가입 화면은 초대 코드를 먼저 서버에서 확인하고, 검증된 전체 프로필 배치가 있을 때만 다음 단계에서
닉네임과 PIN을 받는다. 최종 가입 요청은 초대 코드를 다시 확인하지만 아카이브나
백그라운드 작업에 접속하지 않고, 이미 완성된 결과를
트랜잭션 안에서 계정에 연결한다. 화면의 3~5초 랜덤 프로필과 `~하는 중`
문구는 클라이언트 공개 연출로만 처리하므로 SSE나 긴 요청은 추가하지 않는다.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 22 LTS, Python 3.11 이상

**Primary Dependencies**: Next.js 16.2 App Router, React 19.2, Drizzle ORM, PostgreSQL driver,
Zod, DiceBear Core/Pixel Art; 아카이브 분석은 Python 표준 라이브러리 `sqlite3`, `hmac`,
`hashlib`, `statistics`만 사용

**Storage**: 원본과 user ID는 아카이브 LXC의 SQLite 및 서버 전용 승인 파일에서만 조회;
중간 산출물은 권한이 제한된 JSON; 활성 분석 배치에는 원본 행 개수, 승인 별칭, 요약 특징,
확정 아바타만 PostgreSQL 17에 저장

**Testing**: Python 표준 라이브러리 임시 SQLite 픽스처, Vitest 단위·통합 테스트,
Testing Library 컴포넌트 테스트, Playwright 360px 모바일 종단 테스트

**Target Platform**: Proxmox LXC 108의 Linux/Python 아카이브 환경, Docker Compose를 실행하는
Linux 행사 서버, 최신 모바일·데스크톱 브라우저

**Project Type**: 서버 렌더링과 HTTP 인터페이스를 함께 두는 단일 Next.js 웹 애플리케이션,
외부 통신 없는 일회성 Python 사전 분석 CLI

**Performance Goals**: 약 46만 건 메시지의 전체 분석을 일반 서버에서 15분 안에
완료하고, 정상 가입 응답의 95%를 2초 안에 확정한다. 화면은 제출 후 1초 안에 공개
준비 상태를 표시하고 3~5초 연출을 거쳐 95%가 7초 안에 최종 프로필로 멈춘다.

**Constraints**: 대화 원문은 LXC 밖으로 반출하지 않음; SQLite 읽기 전용; HMAC 비밀값은
저장소·JSON·로그에 포함하지 않음; 동일 정규화 키는 승인 없이 자동 병합하지 않음;
충돌 검토 목록이 남은 배치와 전원 검증 실패 시 일부 import 금지; 실제 닉네임·user ID가
있는 별칭 파일은 Git·Docker 이미지에서 제외; 활성 전체 배치가 없으면 가입 전체 준비 중;
미등록 닉네임 가입 금지; SSE·WebSocket·실시간 아카이브 접속 없음; `prefers-reduced-motion` 준수

**Scale/Scope**: 행사 1개, 아카이브 메시지 약 465,000건, 메시지가 있는 비시스템
사용자 전원(인원은 배치 실행 시 계산), 가입·로비·관리자 상태 화면, 사전 분석·import CLI

## Constitution Check

*GATE: Phase 0 전 검토와 Phase 1 설계 후 재검토 완료.*

| 원칙 | 설계 대응 | 결과 |
|------|-----------|------|
| 행사 경험 우선 | 초대 코드를 먼저 확인하고 사전 분석으로 현장 지연을 없앤다. 활성 전체 배치가 없으면 임시 결과 대신 준비 중 안내로 멈춘다. | PASS |
| 모바일과 접근성 | 360px, 터치·키보드, 상태 문구, 움직임 축소 대체 UI를 테스트한다. | PASS |
| 기록의 보호와 지속성 | 원문을 아카이브에 남기고 HMAC 표식자와 요약만 반출한다. 활성 프로필은 PostgreSQL에 버전 저장한다. | PASS |
| 재현 가능한 자체 호스팅 | 분석·검증·import·백업 명령을 quickstart와 README에 남기고 DB 변경은 마이그레이션으로 적용한다. | PASS |
| 작고 복구 가능한 구현 | 별도 큐·소켓을 추가하지 않고, 일회성 배치와 단일 가입 트랜잭션만 추가한다. 이전 활성 배치는 실패 시 유지한다. | PASS |

설계 후 재검토에서도 예외 승인이 필요한 위반은 없다. 배치 메타데이터와 별칭 테이블은
전원 누락 방지와 가입 충돌 복구라는 현재 요구사항 때문에 필요한 최소 상태다.

## Project Structure

### Documentation (this feature)

```text
specs/003-conversation-avatar/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── analysis-output.schema.json
│   └── openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md                 # $speckit-tasks에서 생성
```

### Source Code (repository root)

```text
app/
├── (public)/join/page.tsx
├── (participant)/lobby/page.tsx
├── admin/page.tsx
├── api/participants/register/route.ts
├── api/admin/participants/route.ts
└── avatars/pixel-art/route.ts
components/
├── avatar/
│   ├── PixelAvatar.tsx
│   ├── DeveloperIdentityCard.tsx
│   └── AvatarReveal.tsx
├── forms/ParticipantAuthForm.tsx
└── admin/ParticipantList.tsx
lib/
├── auth/participant-service.ts
├── avatar/
│   ├── developer-profile.ts
│   ├── generator.ts
│   ├── dicebear.ts
│   └── presentation.ts
├── db/repositories/
│   ├── conversation-profiles.ts
│   └── participants.ts
└── validation/nickname.ts
db/
├── schema.ts
└── migrations/
scripts/
├── analyze_kakao_profiles.py
├── kakao_participants.example.json
├── private/                    # Git·Docker 제외, 서버 전용
│   └── kakao_participants.json
└── import-conversation-profiles.ts
tests/
├── unit/
├── integration/
├── e2e/
└── fixtures/avatar-analysis/
```

**Structure Decision**: 기존 Next.js 단일 애플리케이션과 PostgreSQL을 유지한다. 아카이브
분석과 충돌 검토 목록 생성만 원문이 있는 LXC에서 Python CLI로 실행한다. 실제 별칭과
원본 user ID가 담긴 파일은 저장소 밖 서버 전용 경로에 둔다. 앱은 운영자가 이 파일을
수정해 검토 목록을 비운 산출물 중 user ID가 제거된 깨끗한 JSON만 import하며, import 이후
아카이브와 연결하지 않으며, 공개 연출은 새 클라이언트 컴포넌트 하나로 두어
가입 인증과 분리한다.

## Complexity Tracking

헌법 위반이나 예외 승인이 필요한 복잡성은 없다.
