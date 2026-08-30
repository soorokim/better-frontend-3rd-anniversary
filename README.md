# 프론트엔드 단톡방 3주년

공통 초대 코드로 입장한 참가자가 닉네임과 PIN을 만들고, 닉네임에서 결정적으로 생성된 픽셀 캐릭터를 받아 3주년 질문에 답하는 작은 행사 서비스다. 다시 로그인하면 기존 답변을 불러와 수정할 수 있고, 진행자는 관리자 화면에서 참가자와 제출 여부를 확인하고 PIN 초기화 코드를 발급할 수 있다.

## 바로 실행하기

필요한 것은 Git, Docker Engine, Docker Compose v2다. Node.js는 Docker 밖에서 실행할 때만 필요하며 그 경우 22.13 이상을 사용한다.

```bash
git clone https://github.com/soorokim/better-frontend-3rd-anniversary.git
cd better-frontend-3rd-anniversary
cp .env.example .env
```

`.env`의 `change-me`, `replace-with-...` 값을 전부 바꾼다. 최소한 `NODE_ENV=production`, 접속 주소와 정확히 같은 `APP_ORIGIN`, PostgreSQL 비밀번호, 32자 이상의 `AUTH_PEPPER`·`SESSION_SECRET`, 16자 이상의 초대 코드, 15자 이상의 관리자 비밀번호, 행사 질문을 설정해야 한다.

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps -a
curl -fsS http://localhost:3000/api/health
```

정상이라면 마지막 요청은 `{"status":"ok"}`를 반환한다. 참가자 화면은 `/`, 관리자 로그인은 `/admin/login`이다.

도메인 없이 같은 네트워크에서 쓰는 HTTP 설치와 Caddy를 붙인 HTTPS 설치, 업데이트, 백업·복구, 장애 대응은 [배포 안내서](docs/DEPLOYMENT.md)에 정리해 두었다. 운영 데이터를 지우지 않고 복구를 연습하는 절차도 그 문서를 따른다. 운영 도구는 `scripts/deploy.sh`, `scripts/backup.ps1`, `scripts/restore.ps1`에 있으며, 특히 복구 스크립트는 대상 DB와 정확한 확인 문구를 요구한다.

## 개발 검증

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

통합 테스트와 Playwright는 별도의 테스트 데이터베이스와 실행 중인 앱 설정이 필요하다. 상세 검증 시나리오는 [기능 quickstart](specs/001-event-core-flow/quickstart.md), API 계약은 [OpenAPI 문서](specs/001-event-core-flow/contracts/openapi.yaml)를 참고하면 된다.

## 중요한 운영 메모

- `.env`와 `backups/`는 Git에 커밋하지 않는다.
- `AUTH_PEPPER`와 `SESSION_SECRET`은 설치 뒤 함부로 바꾸지 않는다. 기존 인증 정보와 세션에 영향을 준다.
- 최초 시드는 빈 DB에 관리자 계정을 만든다. 이미 생성된 관리자의 비밀번호는 `.env` 변경이나 재시드만으로 바뀌지 않는다.
- 데이터베이스 포트는 Compose에서 호스트에 공개하지 않는다.
- 픽셀 캐릭터는 외부 이미지가 아니라 자체 HTML/CSS로 그린다. 제3자 고지는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있다.
