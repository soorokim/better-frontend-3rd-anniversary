# High-density avatar atlas v2 prompt

OpenAI 이미지 생성 도구의 built-in 모드로 `layered-parts-concept-v1.png`를 스타일 참고 이미지로
사용해 만든 프로젝트 전용 파츠 시트다.

```text
Use case: stylized-concept
Asset type: production game character layer atlas for a web avatar renderer
Primary request: create a much higher pixel-density version of the modular full-body developer
avatar parts. Use a transparent background, rigid aligned rows, strong navy outlines and dense
1-pixel clusters. Include 3 bodies, 5 hairstyles, 4 outfits, and 8 separate developer items:
rubber duck, coffee, mechanical keyboard, laptop, red error log, green test check, browser tabs,
and USB drive. No labels, text, watermark, blur, soft brush, perspective pose, or cropped limbs.
```

원본 아틀라스는 `high-density-atlas-v2.png`, 배경·내부 구멍을 평평한 라임색으로 분리한
편집 결과는 `high-density-atlas-v2-chroma.png`, 런타임용 256×384 정렬 파츠는 `v2/`에 둔다.
재현 가능한 크롭 좌표와 정렬 규칙은 `scripts/extract_avatar_atlas.py`에 있다.
