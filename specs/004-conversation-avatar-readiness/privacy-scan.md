# 전달 변경 개인정보·비밀값 검사

## 검사 범위

- 검사 일자: 2026-08-30
- 대상: `git diff --name-only`과 `git ls-files --others --exclude-standard`가 반환한 모든 전달 후보 파일
- 파일명 검사: DB dump·backup·SQLite, 실제 분석 profile JSON, merge-review JSON 여부
- 내용 검사: 실제 운영 비밀값, private key, JWT 형태, 비밀번호가 포함된 연결 문자열, session/cookie 비밀값, 카카오 원본 user ID 형태
- 환경 예시 검사: 비밀 성격의 `.env.example` 항목이 실제 값이 아닌 placeholder인지 확인

## 결과

| 검사 항목 | 결과 | 비고 |
| --- | --- | --- |
| 실제 PIN·초대 코드·관리자 비밀번호·세션 비밀값 | 통과 | 알려진 운영 비밀값과 비밀 할당 형태가 전달 후보에서 발견되지 않음 |
| private key·JWT | 통과 | 발견되지 않음 |
| PostgreSQL 연결 문자열 | 통과 | `.env.example`과 quickstart의 로컬 예시만 있으며 운영 자격 증명이 아님 |
| 실제 닉네임·카카오 원본 user ID·대화 원문 | 통과 | 전달 후보에서 발견되지 않음 |
| 실제 분석 JSON·merge review·DB dump | 통과 | 전달 후보 파일명에 없음 |
| 테스트의 session/cookie 탐지 문자열 | 통과 | 개인정보 회귀 테스트용 패턴이며 실제 값이 아님 |
| `.env.example` 비밀 항목 | 통과 | DB 비밀번호, pepper, session secret, invite code, admin password 모두 placeholder |

## 제외 확인

- `scripts/private/kakao_participants.json` 한 개가 로컬에 존재하지만 실제 승인 별칭 자료이므로 내용을 읽지 않았고 전달 대상에서 제외했다.
- 해당 경로와 실제 분석 산출물 패턴은 `.gitignore`와 `.dockerignore`에 모두 포함되어 있다.
- `.next`, Python cache, TypeScript build info 같은 생성물도 전달 대상에서 제외했다.

## 판정

전달 후보에는 실제 비밀값, 운영 DB dump, 실제 분석 JSON, 실제 닉네임·원본 user ID·대화 원문이 없다. T004 복구 커밋을 진행할 수 있다.
