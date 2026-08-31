# Ordinary Bumblebee 32×32 customizable character pack

Source: https://ordinary-bumblebee.itch.io/customizable-character-pack

The source pack was released by Ordinary Bumblebee on 2025-04-09 under CC0 1.0. The original
download contains eight four-direction animation sets. This repository keeps only the six
front-facing idle sheets needed to evaluate the anniversary avatar pilot:

- character/body
- eyes
- hair
- tops
- bottoms
- shoes

Each sheet is arranged as four 32×32 idle frames across and one variant per 32px row. The project
does not redraw these parts. `scripts/generate_avatar_pilot.py` selects rows, combines compatible
layers, scales them with nearest-neighbour sampling, and writes the 256×384 runtime candidates.

The original CC0 text is preserved in `License_CC0.txt`.
