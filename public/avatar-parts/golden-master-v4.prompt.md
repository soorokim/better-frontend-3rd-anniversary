# Golden master v4

Built with OpenAI's built-in image-generation tool using
`high-density-atlas-v2.png` as a style reference. The generated sheet contains one
assembled character and four parts belonging to the same character: hair back,
body and face, outfit, and hair front.

The first result rendered a checkerboard rather than real transparency. A second
background-extraction edit removed only that backdrop. The untouched generation is
`golden-master-v4-source.png`; the transparent edit target is
`golden-master-v4-transparent.png`.

```text
Use case: stylized-concept
Asset type: production modular pixel-avatar golden master sheet
Primary request: draw one internally consistent front-facing developer character and
its modular layers, all sharing the exact same center, landmarks and ground baseline.
Style: polished high-density pixel art matching the project's existing large-headed,
modern developer avatars.
Parts: assembled preview, hair back, body plus face, outfit, hair front.
Constraints: no prop, no hand inside an item or outfit, no labels, no watermark.
```

`scripts/build_golden_avatar_v4.py` converts the reviewed source into full-canvas
256×384 hard-alpha layers. It uses one body-derived scale, one center line and one
baseline instead of fitting every part independently.
