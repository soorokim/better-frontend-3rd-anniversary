# Hand-free item sources

Generated on 2026-08-31 with OpenAI's built-in image-generation tool. `high-density-atlas-v2.png` was supplied only as a style reference. Every source has a genuinely transparent background and contains one object without a hand, arm or character body.

All four prompts shared these constraints:

```text
Use case: stylized-concept
Asset type: modular web-game pixel-art item sprite
Input image: reference atlas for exact pixel density, dark navy outline language, highlights, and palette treatment only
Scene/backdrop: genuinely transparent background
Style/medium: match the reference atlas's polished high-density pixel art, dense deliberate pixel clusters, sharp hard edges, strong dark navy outline, compact game inventory sprite
Composition/framing: one centered isolated object with generous transparent padding, fully visible
Constraints: object only; no hand, fingers, arm, person, pedestal, shadow, UI frame, readable text, logo, watermark, blur, antialiasing, glow, extra objects; preserve true transparency
```

Object-specific requests:

- `item-duck-source.png`: a small cheerful yellow rubber duck, three-quarter front view, orange beak and readable black eye.
- `item-browser-tabs-source.png`: three overlapping navy/blue browser windows with tiny red/yellow/green window dots and pale content lines; no readable text.
- `item-usb-source.png`: a slightly tilted cobalt-blue USB flash drive with a silver connector and tiny cyan developer-symbol marking.
- `item-test-check-source.png`: a dark-navy browser-like test result panel with a vivid green inset screen, one large white check mark and three tiny window dots; no words.

`scripts/generate_avatar_pilot.py` crops each source by alpha, downsizes it with nearest-neighbor sampling, quantizes alpha to 0/255 and places it at the shared `rightGround` anchor.
