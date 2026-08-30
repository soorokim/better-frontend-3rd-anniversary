# Phase 0 Research: 3주년 행사 기본 참여 흐름

## 1. 자체 호스팅 애플리케이션 런타임

**Decision**: 현재 vinext/Sites 초기 틀을 표준 Next.js 16 App Router로 전환하고
`next build`의 standalone 출력물을 Node.js 22 컨테이너에서 실행한다.

**Rationale**: 인증, 서버 검증, PostgreSQL 쓰기가 있어 정적 내보내기는 맞지 않는다.
Cloudflare 배포가 목표가 아닌 데다 아직 기능 코드가 없어서, 플랫폼 호환 계층을 유지하는
것보다 공식 Node 자체 호스팅 경로가 단순하다.

**Alternatives considered**:

- vinext 유지: Cloudflare 통합에는 유리하지만 자체 서버에서는 불필요한 호환 계층이 남는다.
- 프런트와 API 서버 분리: 30명 규모에 배포·인증·계약 관리 비용만 늘어난다.
- 정적 사이트: 서버 인증과 영구 답변 저장 요구사항을 충족하지 못한다.

**Sources**:

- https://nextjs.org/docs/app/getting-started/deploying
- https://nextjs.org/docs/app/guides/self-hosting
- https://nextjs.org/docs/13/app/api-reference/next-config-js/output
- https://github.com/cloudflare/vinext/blob/main/README.md

## 2. 데이터 접근과 마이그레이션

**Decision**: PostgreSQL 17과 Drizzle ORM을 사용한다. 스키마와 SQL 마이그레이션을
저장소에 포함하고, Compose의 일회성 `migrate` 서비스가 앱 시작 전에 적용한다.

**Rationale**: 참가자·세션·답변·제출 여부를 트랜잭션으로 함께 다뤄야 한다. PostgreSQL 17은
지원 기간이 충분하고 공식 컨테이너의 볼륨 규칙이 안정적이다. Drizzle은 작은 TypeScript
프로젝트에서 스키마와 실제 SQL을 가깝게 유지하면서 별도 백엔드 계층을 만들지 않게 해준다.

**Alternatives considered**:

- SQLite: 30명에는 가능하지만 운영 백업·동시 쓰기·향후 게임 상태 확장을 생각하면
  PostgreSQL을 다시 도입할 가능성이 높다.
- Prisma: 성숙한 선택이지만 이번 스키마에는 생성 계층과 런타임 구성이 더 크다.
- 직접 SQL만 사용: 의존성은 줄지만 타입과 반복적인 매핑 코드를 직접 관리해야 한다.

**Sources**:

- https://www.postgresql.org/support/versioning/
- https://hub.docker.com/_/postgres/
- https://orm.drizzle.team/docs/overview

## 3. Docker Compose와 HTTPS 경계

**Decision**: `caddy`, `app`, `migrate`, `db` 네 서비스를 둔다. 외부에는 Caddy의 80/443만
열고, 데이터베이스 포트는 공개하지 않는다. 서버에 기존 프록시가 있으면 Caddy 프로필을
끄고 앱 포트를 `127.0.0.1`에만 연결할 수 있게 한다.

**Rationale**: 데이터베이스 health check 이후 마이그레이션, 그 성공 이후 앱이라는 시작
순서를 명확히 만들 수 있다. Caddy는 작은 자체 호스팅 서비스의 인증서 발급과 갱신을
간단하게 처리한다.

**Alternatives considered**:

- 앱에서 직접 TLS 종료: 인증서 갱신과 프록시 책임이 애플리케이션에 섞인다.
- Kubernetes: 단일 서버·단일 인스턴스에 비해 운영 부담이 지나치게 크다.
- Redis와 공유 캐시: 단일 앱 인스턴스와 30명 규모에서는 필요하지 않다.

**Sources**:

- https://docs.docker.com/compose/how-tos/startup-order/
- https://docs.docker.com/compose/how-tos/networking/
- https://caddyserver.com/docs/automatic-https
- https://caddyserver.com/docs/caddyfile/directives/reverse_proxy

## 4. 참가자 및 관리자 인증

**Decision**: 참가자는 16자 이상의 무작위 초대 코드, 고유 닉네임, 정확히 6자리 숫자
PIN을 사용한다. 초대 코드와 PIN은 Argon2id로 검증하며 별도 서버 pepper를 사용한다.
관리자는 참가자 정보와 분리된 15자 이상의 무작위 비밀번호를 사용한다.

**Rationale**: 숫자 PIN은 경우의 수가 적지만 행사 현장에서 입력하기 쉽다. 공유 초대 코드,
강한 해시, 서버 비밀값, 짧은 세션, 점진적 재시도 제한을 함께 사용해 이 의도적인 절충을
보완한다. 이 방식은 민감한 개인정보나 금전 정보를 다루는 서비스로 확대하지 않는다.

**Alternatives considered**:

- 4자리 PIN: 온라인·오프라인 추측 범위가 너무 작다.
- 일반 장문 비밀번호 또는 패스키: 더 안전하지만 1차 행사 UX와 운영 범위를 벗어난다.
- 이메일·소셜 로그인: 연락처 수집과 외부 서비스 의존성이 생긴다.

**Sources**:

- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- https://pages.nist.gov/800-63-4/sp800-63b.html

## 5. 세션, 재시도 제한과 PIN 초기화

**Decision**: 최소 128비트 무작위 토큰의 서버 저장형 세션을 사용한다. 쿠키는
`__Host-` 접두사, Secure, HttpOnly, SameSite=Strict, Path=/를 적용하고 상태 변경에는
CSRF 검증을 추가한다. 참가자 세션은 idle 30분·absolute 12시간, 관리자 세션은 idle
15분·absolute 4시간이다.

닉네임과 IP를 함께 보는 점진적 재시도 제한을 PostgreSQL에 저장한다. PIN 초기화는 기존
세션을 즉시 폐기하고, 관리자가 한 번만 확인할 수 있는 8자리 코드로 진행한다. 코드는
10분 후 만료되고 5회 실패하거나 사용되면 폐기된다.

**Rationale**: 서버 세션은 즉시 폐기가 쉽고 JWT 회수 목록이 필요 없다. 단순 초기화 플래그는
공통 초대 코드를 아는 사람이 다른 닉네임을 탈취할 수 있으므로 짧은 일회용 코드가 필요하다.

**Alternatives considered**:

- 브라우저 저장소의 JWT: XSS 노출과 즉시 회수가 어렵다.
- 영구 계정 잠금: 다른 사람이 닉네임만 알아도 행사 참여를 막을 수 있다.
- 이메일·SMS 초기화: 연락처와 외부 연동이 필요하다.

**Sources**:

- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

## 6. 교체 가능한 결정적 아바타

**Decision**: 참가자 ID, 아바타 입력, 선택된 파츠를 분리한다. 1차 입력은
`nickname-key-v1`으로 정규화한 닉네임의 digest이고, 생성기는 `source kind`,
`source version`, `generator version`, `catalog version`을 함께 받아 특성별 독립 SHA-256
결과로 안정된 파츠 ID를 고른다. 선택 결과를 저장하고 새 버전은 기존 배정을 덮어쓰지 않는다.

**Rationale**: 참가자와 답변이 닉네임이나 캐릭터에 종속되지 않아서 대화 지문으로 입력을
바꿔도 기록이 유지된다. 특성별 독립 해시는 파츠 종류를 추가해도 기존의 다른 특성이
연쇄적으로 바뀌지 않는다.

**Alternatives considered**:

- 닉네임을 참가자 ID로 사용: 닉네임 변경과 충돌이 답변 관계를 깨뜨린다.
- `Math.random()`: 시드와 알고리즘이 고정되지 않아 재현할 수 없다.
- 하나의 순차 PRNG: 중간 특성 추가가 뒤의 모든 파츠 결과를 바꾼다.
- 아바타 배열 인덱스 저장: 카탈로그 순서를 바꾸면 기존 결과를 재현할 수 없다.

**Sources**:

- https://www.unicode.org/reports/tr15/
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
- https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
- https://nodejs.org/api/webcrypto.html

## 7. 백업과 검증 전략

**Decision**: PostgreSQL named volume과 별도로 `pg_dump -Fc` 백업을 만들고, 운영 전 빈
데이터베이스에 복구하는 검증을 수행한다. 단위 테스트는 정규화·아바타·검증 규칙을,
통합 테스트는 실제 PostgreSQL의 인증·권한·트랜잭션을, 종단 테스트는 360px 참가자 흐름과
관리자 PIN 초기화를 담당한다.

**Rationale**: volume은 실수나 스키마 오류에 대한 백업이 아니다. 이 기능의 가장 큰 위험은
화면 렌더링보다 참가자 기록 손실과 권한 누출이라 실제 저장소를 포함한 검증이 필요하다.

**Alternatives considered**:

- volume 복사만 수행: 실행 중 일관성과 복구 가능성을 보장하기 어렵다.
- 모든 테스트를 브라우저 테스트로 작성: 느리고 실패 원인 분리가 어렵다.

**Sources**:

- https://www.postgresql.org/docs/17/backup-dump.html
- https://playwright.dev/docs/test-mobile
