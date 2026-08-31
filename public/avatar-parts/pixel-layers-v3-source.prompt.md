# Pixel Layers v3 — continuity source

The first v3 pilot changed the character style too far and was rejected during review. The revised pilot uses the existing project-owned `high-density-atlas-v2.png` as its visual source so participants keep the large head, detailed hair, modern clothing and longer-limbed silhouette they have already seen.

## Original high-density source prompt

```text
Use case: stylized-concept
Asset type: production game character layer atlas for a web avatar renderer
Primary request: create a much higher pixel-density version of the modular full-body developer
avatar parts. Use a transparent background, rigid aligned rows, strong navy outlines and dense
1-pixel clusters. Include 3 bodies, 5 hairstyles, 4 outfits, and 8 separate developer items:
rubber duck, coffee, mechanical keyboard, laptop, red error log, green test check, browser tabs,
and USB drive. No labels, text, watermark, blur, soft brush, perspective pose, or cropped limbs.
```

The revised runtime layers are normalized by `scripts/generate_avatar_pilot.py`: lime residue and soft alpha are removed, each hairstyle stays intact, and baked-in skin is removed from outfits. The four objects are newly generated hand-free sources documented in `public/avatar-parts/v3/sources/README.md` and are displayed independently at the lower-right instead of being held.
