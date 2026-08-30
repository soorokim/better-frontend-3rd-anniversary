# 대화 아바타 통합 인벤토리

## 안전 기준점

- 작업 브랜치: `codex/conversation-avatar`
- 분류 시작 SHA: `bc2f0a3425259e71c3f877053af891dffab51547`
- 분류 일자: 2026-08-30
- 상태: `003` 구현과 `004` 설계가 수정·미추적 파일에 있으며, 재배치 전에 전부 복구 커밋으로 고정해야 한다.

## 전달 대상

아래 경로는 `003` 대화 아바타 구현 또는 이를 검증·운영하는 자료이므로 복구 커밋에 포함한다.

- 프로젝트 설정·문서: `.dockerignore`, `.env.example`, `.gitignore`, `README.md`, `THIRD_PARTY_NOTICES.md`, `docs/DEPLOYMENT.md`, `package.json`, `package-lock.json`, `public/avatar-parts/README.md`
- 참가자·관리자 UI: `app/(participant)/lobby/page.tsx`, `app/admin/page.tsx`, `app/globals.css`, `components/admin/AvatarProfileStatus.tsx`, `components/avatar/AvatarReveal.tsx`, `components/avatar/DeveloperIdentityCard.tsx`, `components/avatar/PixelAvatar.tsx`, `components/forms/ParticipantAuthForm.tsx`
- API: `app/api/admin/avatar-profiles/route.ts`, `app/api/invitations/verify/route.ts`, `app/api/participants/register/route.ts`, `app/avatars/pixel-art/route.ts`
- 데이터 모델·마이그레이션: `db/schema.ts`, `db/migrations/0002_conversation_profiles.sql`, `db/migrations/meta/_journal.json`
- 서버 로직: `lib/auth/admin-service.ts`, `lib/auth/participant-service.ts`, `lib/avatar/developer-profile.ts`, `lib/avatar/dicebear.ts`, `lib/avatar/generator.ts`, `lib/avatar/presentation.ts`, `lib/db/repositories/conversation-profiles.ts`, `lib/db/repositories/participants.ts`, `lib/observability/logger.ts`, `lib/validation/auth.ts`, `lib/validation/conversation-profile.ts`
- 분석·운영 스크립트: `scripts/README.md`, `scripts/analyze_kakao_profiles.py`, `scripts/benchmark-conversation-avatars.md`, `scripts/import-conversation-profiles.ts`, `scripts/kakao_participants.example.json`, `scripts/validate-conversation-profiles.ts`
- `003` 설계: `specs/003-conversation-avatar/` 아래의 명세, 계획, 데이터 모델, 계약, 체크리스트, quickstart, research, tasks 전체
- 자동 검증: `tests/e2e/`, `tests/fixtures/avatar-analysis/`, `tests/helpers/`, `tests/integration/`, `tests/unit/`, `tests/test_analyze_kakao_profiles.py`에서 이번 변경에 추가·수정된 파일 전체

아래 경로는 `004` 배포 준비 기능의 설계·검증 자료이므로 복구 커밋에 포함한다.

- `specs/004-conversation-avatar-readiness/spec.md`
- `specs/004-conversation-avatar-readiness/plan.md`
- `specs/004-conversation-avatar-readiness/research.md`
- `specs/004-conversation-avatar-readiness/data-model.md`
- `specs/004-conversation-avatar-readiness/quickstart.md`
- `specs/004-conversation-avatar-readiness/contracts/`
- `specs/004-conversation-avatar-readiness/checklists/requirements.md`
- `specs/004-conversation-avatar-readiness/tasks.md`
- 이 인벤토리와 `privacy-scan.md`

## 로컬 전용 자료

다음은 전달 대상이 아니며 커밋하지 않는다.

- `scripts/private/kakao_participants.json`: 실제 승인 별칭 규칙. `.gitignore`와 `.dockerignore`로 제외한다.
- `.specify/feature.json`: 로컬 Spec Kit 선택 상태다.
- `.next/`, `node_modules/`, `tsconfig.tsbuildinfo`, `scripts/__pycache__/`, `tests/__pycache__/`: 생성물과 로컬 캐시다.

## Ignore 설정 점검

- `.gitignore`는 Node/Next 생성물, `.env*`(단 `.env.example` 제외), 백업, 비밀 파일, 실제 분석 JSON, SQLite, Python 캐시를 제외한다.
- `.dockerignore`는 Git/Node/Next 생성물, `.env*`(단 `.env.example` 제외), 명세·에이전트 자료, 백업, 실제 분석 입력·출력을 제외한다.
- `eslint.config.mjs`의 전역 ignore는 `.next`, `out`, `build`, `next-env.d.ts`를 포함한다.
- npm 패키지 배포 프로젝트가 아니므로 `.npmignore`는 만들지 않는다. Prettier, Terraform, Helm 설정도 없어 별도 ignore 파일이 필요하지 않다.

## 재배치 기록

### 고정 입력

- 로컬 기준선 `codex/mvp-core-flow`: `ca9f8fa507a9dbb6077f5ddd1a66a6034a342363`
- 원격 기준선 `origin/codex/mvp-core-flow`: `ca9f8fa507a9dbb6077f5ddd1a66a6034a342363`
- 로컬/원격 ahead-behind: `0/0`
- 복구 태그 대상 SHA: `4982246ae2c9a90d887e5bf327fc0513c6fb2a59`
- 복구 태그: `conversation-avatar-pre-rebase`

T006~T010에서 충돌 파일, 재배치 후 HEAD와 정적·단위 검증 결과를 이어서 기록한다.

### 재배치와 충돌 해결

- 재배치 기준: `ca9f8fa507a9dbb6077f5ddd1a66a6034a342363`
- 재배치 직후 HEAD: `2e724a7f06e5cddf889813e88142c7c06e7bfc33`
- 기준선 ancestor 확인: 통과
- 복구 태그 대상 유지: `4982246ae2c9a90d887e5bf327fc0513c6fb2a59`
- 실제 충돌 파일: `.env.example`, `app/admin/page.tsx`, `db/migrations/meta/_journal.json`, `lib/observability/logger.ts`, `package.json`, `tests/helpers/database.ts`
- 자동 병합 후 별도 확인한 핵심 파일: `README.md`, `docs/DEPLOYMENT.md`, `db/schema.ts`, `package-lock.json`, `THIRD_PARTY_NOTICES.md`, `public/avatar-parts/README.md`

충돌 해결은 개발 전용 demo 설정과 아카이브 HMAC 설명, 진행자 링크와 대화 프로필 현황,
진행자·대화 프로필 테스트 테이블, 발표 로그와 개인정보 redaction, demo seed와 avatar CLI를
각각 함께 보존했다. 최종 schema에는 진행자 테이블, 대화 프로필·별칭·배치, conversation
avatar 연결, `participant_register` action과 batch/event 및 profile/batch 복합 관계를 모두
포함했다.

`0002_conversation_profiles.sql`과 journal의 임시 `0002_conversation_profiles` tag는 이
체크포인트에서 이름을 바꾸지 않았다. 두 `0002` 충돌을 실제로 없애고 최종 SQL과 journal을
생성하는 작업은 계획대로 US1의 T014~T015에서 수행한다.
