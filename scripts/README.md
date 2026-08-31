# 대화 프로필 분석 도구

`analyze_kakao_profiles.py`는 카카오 아카이브 LXC 안에서만 실행한다. SQLite는 `mode=ro`로 열고, 메시지 본문은 메모리에서 통계와 HMAC을 만드는 데만 쓴다. 앱 서버로 옮길 수 있는 것은 `merge_review`, `unmatched`가 모두 비어 있고 `npm run avatar:validate`를 통과한 JSON뿐이다.

실제 별칭 규칙은 `scripts/private/kakao_participants.json` 또는 서버의 `/etc/frontend-avatar/private/`처럼 Git 밖 경로에 둔다. 형식은 `kakao_participants.example.json`을 따른다.

```json
{
  "schema_version": "kakao-participant-aliases-v2",
  "profiles": [
    {
      "join_nickname": "행사에서 입력할 대표 닉네임",
      "aliases": ["예전에 사용한 승인 닉네임"],
      "source_user_ids": [101, 205]
    }
  ]
}
```

`source_user_ids`는 분석 서버 밖으로 복사하지 않는다. 같은 정규화 키가 여러 원본 행에 있으면 분석기는 추측해서 합치지 않고 로컬 `merge_review`에 적는다. 그 목록을 사용자가 확인한 다음에만 아래처럼 진행한다.

1. 같은 사람이라면 한 규칙의 `source_user_ids`에 승인한 행을 함께 적는다.
2. 다른 사람이라면 원본 행별로 규칙을 나누고 서로 다른 `join_nickname`을 정한다.
3. 전체 인원을 다시 분석한다. 일부만 이어서 처리하지 않는다.
4. `merge_review`와 `unmatched`가 빈 결과만 검증·전송한다.

기존에 쓰던 단순 `{ "닉네임": ["별칭"] }` 파일도 읽을 수 있지만 원본 행 충돌을 확실하게 해결하려면 v2 형식을 사용한다. 실제 운영 순서는 [`specs/003-conversation-avatar/quickstart.md`](../specs/003-conversation-avatar/quickstart.md)에 있다.

## 픽셀 아바타 원본 정리

`extract_avatar_atlas.py`는 런타임 서버가 아니라 에셋을 만드는 개발 환경에서만 실행한다.
필요한 Pillow 버전은 별도 파일에 고정되어 있다.

```powershell
python -m pip install -r scripts/requirements-avatar.txt
python scripts/extract_avatar_atlas.py
```

생성된 파일은 `npm run avatar:assets:validate`로 크기, 투명도, 안전 영역과 manifest를
검사한 뒤 사용한다. 운영 app 컨테이너에는 Python이나 Pillow가 필요하지 않다.
