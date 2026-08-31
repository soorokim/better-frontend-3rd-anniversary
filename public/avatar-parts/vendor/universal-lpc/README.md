# Universal LPC pilot subset

Source: https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator

This directory contains only the front-facing source sheets selected for the
`pixel-layers-v3` pilot. The upstream project has many contributors and per-asset licenses, so
`CREDITS.csv` and the selected `sheet_definitions/` files are retained beside the images. The
repository-level `LICENSE` is also included.

Selected parts include the male body and human head, neutral eyes, parted/bob/high-ponytail/spiked
hair, T-shirt/cardigan/formal shirt/collared jacket, long pants and revised shoes. Their licenses
include CC0, CC-BY 4.0, CC-BY-SA 3.0, OGA-BY 3.0 and GPL 3.0; use the matching definition JSON and
`CREDITS.csv` row as the authoritative attribution record.

`scripts/generate_avatar_pilot.py` takes one down-facing walk frame, applies a deterministic
three-stop recolor only to recolorable layers, enlarges it 5x with nearest-neighbour sampling and
places it on the shared 256x384 canvas. The upstream source pixels are not AI-redrawn.
