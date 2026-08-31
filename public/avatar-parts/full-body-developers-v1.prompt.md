# Full-body developers v1 생성 기록

생성일: 2026-08-31

도구: Codex 내장 OpenAI 이미지 생성 도구

## 최초 생성 프롬프트

```text
Use case: stylized-concept
Asset type: production game character sprite atlas for a Korean frontend community anniversary web service
Input images: the supplied screenshot is a style and color reference only; do not reproduce its browser UI or text
Primary request: create exactly 16 distinct full-body pixel-art developer characters arranged in a strict 4 by 4 grid
Scene/backdrop: genuinely transparent background, no panel, no floor, no scenery
Subject: friendly adult developer avatars, each standing front-facing in a neutral idle pose, entire body visible from hair to shoes; varied hair, skin tones, outfits, glasses and hats; subtle developer-themed handheld details such as laptop, keyboard, coffee, book, rubber duck, USB, or tiny error log
Style/medium: crisp authentic 16-bit pixel art with hard square pixels, limited palette, no antialiasing, matching the reference's navy, muted purple, yellow, pink, mint and sky-blue mood
Composition/framing: exact equal-size 4x4 cells, one centered character per cell, identical scale and baseline, generous transparent padding, no overlap
Constraints: transparent alpha; exactly 16 characters; full body clearly visible; strong silhouettes at small sizes; consistent proportions and lighting; no text, labels, numbers, UI, logos, borders, shadows outside each character, watermark, or background; keep every character inside its own cell
```

## 투명 배경 편집 프롬프트

```text
Use case: background-extraction
Asset type: production game character sprite atlas
Input images: the generated atlas is the exact edit target
Primary request: remove only the gray-and-white checkerboard background and replace it with genuine transparent alpha
Constraints: preserve all 16 pixel-art characters exactly; preserve the exact strict 4x4 layout, canvas size, character positions, scale, colors, hard pixel edges, accessories, and full-body silhouettes; do not redraw, restyle, crop, move, resize, add, or remove any character; no background color, no checkerboard, no shadow, no text, no watermark; output a PNG with real transparency
```
