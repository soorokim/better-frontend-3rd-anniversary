# Implementation Plan: 모듈형 픽셀 아바타 재구성

**Branch**: `005-rebuild-avatar-parts` | **Date**: 2026-08-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-rebuild-avatar-parts/spec.md`

## Summary

기존 `pixel-parts-v1` 카탈로그, 생성기와 저장된 참가자 배정은 그대로 둔다. 대신 시각
에셋을 별도 버전 `pixel-layers-v3`로 만들고, 모든 파츠가 공유하는 256×384 캔버스와
역할별 소유권을 manifest로 고정한다. 먼저 위험 요소가 다른 대표 조합 4개를 관리자 전용
검토 화면에서 승인하고, 승인 뒤에 전체 파츠로 확장한다. 렌더러는 필요한 레이어를 모두
불러온 뒤 한 번에 표시하며, 하나라도 실패하면 조각난 캐릭터 대신 완성된 기본 캐릭터를
유지한다.

현재 저장 카탈로그의 결정적 조합은 1,200개다. 대화 장비 별칭을 정규화하면 화면에 실제로
나올 수 있는 고유 조합은 2,160개이므로 두 범위를 따로 검증한다. 정적 에셋 검사, 배정 회귀
테스트, 실제 크기별 브라우저 검사와 운영자 시각 승인을 모두 통과해야 `v3`를 활성화한다.

## Technical Context

**Language/Version**: TypeScript 5.9.3 on Node.js 22.13+, React 19.2.6; Python 3와 Pillow는 오프라인 원본 정리 스크립트에만 사용

**Primary Dependencies**: Next.js 16.2.6, React 19.2.6, Zod 4.1.5, 정적 RGBA PNG; 에셋 검증용 `sharp` 개발 의존성

**Storage**: PostgreSQL 17은 기존 참가자·아바타 배정에 그대로 사용하며 스키마 변경 없음; 새 에셋 manifest, 승인 기록과 PNG는 Git에 저장

**Testing**: Vitest 3.2.4, Testing Library, Playwright 1.55, manifest/PNG 검증 스크립트, 운영자 파일럿 검토

**Target Platform**: Docker Compose로 자체 호스팅하는 Linux/Node 서버, 최신 모바일·데스크톱 Chromium 계열 브라우저

**Project Type**: Next.js 단일 웹 서비스

**Performance Goals**: 정상 행사 네트워크에서 로비 방문의 95%가 2초 안에 완성된 아바타를 표시; 캐시된 조합은 부분 레이어 노출 없이 즉시 전환

**Constraints**: 360px 모바일 로비와 실제 48/52/76/80/192px 표시 크기 지원, 픽셀 경계 유지, 얼굴 침범 0%, 아이템 몸통 침범 30% 이하, 승인 전 후보 에셋 운영 노출 금지

**Scale/Scope**: 저장 배정 조합 1,200개, 정규화된 고유 화면 조합 2,160개, body 3종·hair 5종·outfit 4종·고유 item 9종·accent 4종, 대표 조합 4개

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Phase 0 진입 점검

- **행사 경험 우선 — PASS**: 참가자가 가장 먼저 보는 로비 캐릭터의 깨짐과 가림을 직접 해결한다. 대표 4개 승인 전 전체 제작을 막아 불필요한 작업을 줄인다.
- **모바일과 접근성 — PASS**: 360px 로비를 첫 기준으로 삼고 현재 사용 중인 48/52/76/80/192px 크기를 모두 검증한다. 기존 `role="img"`와 설명 계약을 유지한다.
- **기록 보호와 지속성 — PASS**: 대화 원문과 프로필 저장값을 읽거나 다시 계산하지 않는다. 실패 진단에는 파츠 역할과 ID만 남긴다.
- **재현 가능한 자체 호스팅 — PASS**: 모든 런타임 에셋과 manifest를 저장소와 Docker 이미지에 포함한다. 외부 이미지 API나 CDN에 의존하지 않는다.
- **작고 복구 가능한 구현 — PASS**: 저장 카탈로그와 DB를 건드리지 않고 `v2`를 마지막 승인본으로 유지한다. `v3`는 파일럿, 승인, 전체 전환의 작은 단계로 나눈다.
- **라이선스와 출처 — PASS**: 모든 에셋에 출처와 재배포 가능 여부를 연결하고 문서 불일치를 같은 변경에서 고친다.

해결되지 않은 명세 질문이나 헌법 위반은 없다.

### Phase 1 설계 후 재점검

- 관리자 검토 화면은 기존 관리자 세션으로 보호하며 새 공개 API를 만들지 않는다.
- manifest의 `phase`와 승인 기록이 활성 에셋 전환을 막으므로 파일럿이 참가자에게 섞이지 않는다.
- 원자적 로딩과 완성본 fallback이 네트워크 지연·파일 누락 때도 부분 캐릭터 노출을 막는다.
- DB migration과 새 운영 서비스가 없고, 개발 의존성 하나와 정적 파일 계약만 추가한다.

모든 게이트가 다시 통과했다. Complexity Tracking에 기록할 예외는 없다.

## Project Structure

### Documentation (this feature)

```text
specs/005-rebuild-avatar-parts/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── avatar-asset-manifest.schema.json
│   └── avatar-rendering-contract.md
├── checklists/requirements.md
├── validation/pilot-review.md       # 구현 중 생성
└── tasks.md                         # $speckit-tasks 출력
```

### Source Code (repository root)

```text
app/
├── (participant)/lobby/page.tsx
├── admin/avatar-review/page.tsx    # 관리자 전용 pilot/full 검토 화면
├── avatar-lab/page.tsx             # 개발 전용 진입점, 운영 기본 비활성
└── globals.css
components/avatar/
├── PixelAvatar.tsx                 # 공개 props 유지, 원자 로딩/fallback
├── AvatarAssetLayers.tsx           # manifest 기반 레이어 로더
├── AvatarReviewGrid.tsx            # 실제 사용 크기와 전체 조합 검토
└── AvatarReveal.tsx
lib/avatar/
├── catalog.ts                      # pixel-parts-v1 동결
├── generator.ts                    # avatar-generator-v1 동결
├── presentation.ts                 # 기존 ID를 canonical 시각 ID로 해석
└── assets/
    ├── manifest.ts
    └── pixel-layers-v3.json
public/avatar-parts/
├── README.md
└── v3/
    ├── fallback-default.png
    ├── body-*.png
    ├── hair-*-back.png
    ├── hair-*-front.png
    ├── outfit-*.png
    ├── item-*.png
    └── validation/{face-mask,torso-mask}.png
scripts/
├── extract_avatar_atlas.py
├── requirements-avatar.txt         # 오프라인 제작용 Pillow 버전 고정
└── validate-avatar-assets.ts
tests/
├── fixtures/avatar-assignments-v1.json
├── unit/{avatar-assets,avatar-assignment-regression,avatar-presentation,pixel-avatar}.test.*
└── e2e/{avatar-visual,avatar-context-parity}.spec.ts
```

**Structure Decision**: 기존 Next.js 단일 애플리케이션 안에서 정적 에셋과 렌더러만
교체한다. 참가자, 관리자 목록과 진행자 화면은 모두 현재 `PixelAvatar` 공개 API를 계속
사용하므로 화면마다 다른 구현을 만들지 않는다. 검토 UI만 관리자 아래에 추가하고 승인
기록은 저장소 문서로 남긴다. 런타임 데이터가 아니므로 DB 테이블이나 승인 API를 만들지
않는다.

## Design Decisions

### 1. 배정 버전과 시각 에셋 버전 분리

- `AVATAR_CATALOG_VERSION='pixel-parts-v1'`, ID 순서, 생성기 해시와 저장된 traits를 동결한다.
- `pixel-layers-v3`는 렌더링 파일 버전일 뿐 참가자 정체성에 들어가지 않는다.
- `terminal → laptop`, `book → error-log`는 시각 alias로만 정규화하며 대화 장비 8개를 그대로 지원한다.
- `/avatars/pixel-art` 호환 API의 seed, URL과 캐시는 바꾸지 않는다.

### 2. 공통 캔버스와 레이어 소유권

- 모든 파츠는 128×192 논리 격자에서 만들고 nearest-neighbor로 정확히 2배 내보낸 256×384 RGBA PNG다.
- 런타임에서 파츠별 확대, 이동과 `background-size` 보정을 하지 않는다.
- 순서는 `hairBack → body → outfit → faceFeatures → hairFront → item → accent`다.
- body는 피부, 얼굴 바탕과 기본 신체만, hair는 머리카락만, outfit은 의상만, item은 물체만 가진다. item에는 손을 그리지 않는다.
- 기준 안전 영역과 anchor는 [manifest 계약](contracts/avatar-asset-manifest.schema.json)에 한 번만 둔다. 파일럿 승인 뒤 고정한다.

### 3. 파일럿 승인 후 전체 확장

- 네 대표 조합은 짧은/긴/높은 머리, 네 의상, 세 피부색, 작은/넓은/큰 아이템과 네 accent를 나눠 포함한다.
- `phase=pilot` 에셋은 관리자 검토 화면에서만 볼 수 있고 현재 승인된 `v2` 운영 렌더러는 유지한다.
- 360px 로비와 48/52/76/80/192px 실제 크기에서 네 조합 모두 통과하고 `validation/pilot-review.md`가 승인된 뒤에만 나머지 파츠를 만든다.
- 전체 파츠와 2,160개 고유 화면 조합 검증 뒤 `phase=approved`로 바꾸고 활성 에셋 상수만 `v3`로 전환한다.

### 4. 원자적 표시와 fallback

- SSR 첫 화면에는 완성된 프로젝트 소유 fallback을 표시한다.
- 필요한 모든 레이어가 성공적으로 준비된 뒤에만 조합 캐릭터로 한 번에 전환한다.
- 알 수 없는 ID, 파일 누락, 로드 오류 또는 시간 초과가 하나라도 있으면 부분 조합을 보여주지 않고 fallback을 유지한다.
- 운영 진단에는 `role`, `partId`, 실패 유형만 남기고 닉네임, 해시와 대화 정보는 남기지 않는다.

### 5. 자동 검사와 사람 검토의 경계

- 자동 검사는 파일 존재, 해시, 크기, RGBA, hard alpha, 안전 경계, 얼굴 침범 0%, 몸통 침범 30% 이하, alias 완전성과 조합 해석을 담당한다.
- 손·발 중복, 아이템 의미 식별과 전체 인상은 색상 추론으로 판정하지 않고 대표 조합과 contact sheet의 사람 검토로 남긴다.
- 브라우저 검사는 요소만 잘라 기준 이미지를 비교하고 전체 페이지 스냅샷은 폰트 차이 때문에 사용하지 않는다.

## Complexity Tracking

헌법 위반이나 예외 승인이 필요한 복잡성은 없다.
