# US2 승인 별칭 계정 복구 검증

- 검증 시각: 2026-08-30T20:28:48+09:00
- 범위: T021~T028
- 환경: 운영과 분리된 WSL loopback PostgreSQL 16.2의 삭제 가능한 테스트 DB
- 개인정보: 합성 fixture만 사용했으며 실제 닉네임, PIN, 초기화 코드, IP, 답변 전문은 기록하지 않음

## 이름 해석

- 활성 배치의 정식 닉네임과 승인 별칭이 같은 participant/profile ID로 해석됨
- 기존 참가자의 정식 닉네임과 아직 선점되지 않은 활성 프로필도 같은 계정으로 해석됨
- 직접 닉네임과 다른 참가자가 선점한 별칭이 겹치면 `ambiguous`이며 어느 계정도 선택하지 않음
- 비활성 배치의 정식 닉네임과 별칭은 `not_found`로 처리됨

## PIN 복구와 데이터 보존

- 승인 별칭 가입 → 관리자 초기화 코드 발급 → 같은 별칭으로 PIN 변경 → 재로그인 성공
- PIN 변경 전후 participant ID, answer ID, current avatar ID가 모두 같음
- 이전 PIN 로그인은 실패하고 새 PIN 로그인만 성공함
- 미등록 이름 20회와 충돌 이름 20회가 모두 같은 401 `invalid_credentials` 계약을 반환함
- 위 40회 시도에서 participant와 reset grant 변경은 0건임

## 자동 검증 결과

- US2 관련 PostgreSQL 통합 테스트: 5 files, 15 tests 통과
- 전체 PostgreSQL 통합 회귀: 18 files, 70 tests 통과
- Playwright 모바일 별칭 복구 흐름: 1 test 통과, 11.8초
- 단위 테스트: 12 files, 57 tests 통과
- Python 분석 테스트: 2 tests 통과
- lint, typecheck, production build, `git diff --check`: 통과

브라우저 검증은 민감정보 없는 대화 프로필 fixture를 새 DB에 import한 뒤 실행했다. 검증용
Next.js와 PostgreSQL 프로세스는 종료하고 임시 DB 파일도 삭제했다. 운영 서버, 운영 DB,
현재 행사 Compose project에는 연결하지 않았다.
