"""Build one aligned golden avatar set from the reviewed v4 source sheet.

This deliberately does not crop and fit every part independently. All layers use the
body scale, one center line and one ground baseline, so their transparent padding is
part of the asset contract.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "avatar-parts" / "golden-master-v4-transparent.png"
OUTPUT = ROOT / "public" / "avatar-parts" / "v4-golden"
CANVAS = (256, 384)
CENTER_X = 128
BASELINE_Y = 370
SOURCE_SCALE = 0.64

# Equal source-sheet cells. Bounds inside each cell are measured once from the
# golden sheet; their relative placement is expressed against the shared body.
CELLS = {
    "assembled-reference": ((0, 0, 396, 793), (60, 97, 350, 675), 0, 0),
    "hair-back": ((396, 0, 793, 793), (63, 207, 340, 465), 0, -69),
    "body-face-warm": ((793, 0, 1190, 793), (66, 166, 310, 671), 0, 0),
    "outfit-navy-mint": ((1190, 0, 1586, 793), (36, 335, 301, 675), 0, 170),
    "hair-front-indigo": ((1586, 0, 1983, 793), (50, 257, 320, 479), 0, -69),
}


def hard_alpha(image: Image.Image) -> Image.Image:
    source = image.convert("RGBA")
    output = Image.new("RGBA", source.size, (0, 0, 0, 0))
    output.putdata([
        (red, green, blue, 255) if alpha >= 112 else (0, 0, 0, 0)
        for red, green, blue, alpha in source.getdata()
    ])
    return output


def extract(source: Image.Image, cell, bounds) -> Image.Image:
    cell_image = source.crop(cell)
    return hard_alpha(cell_image.crop(bounds))


def place(part: Image.Image, y_offset_from_body: int) -> Image.Image:
    width = max(1, round(part.width * SOURCE_SCALE))
    height = max(1, round(part.height * SOURCE_SCALE))
    scaled = hard_alpha(part.resize((width, height), Image.Resampling.NEAREST))
    body_height = round(505 * SOURCE_SCALE)
    body_top = BASELINE_Y - body_height
    x = CENTER_X - width // 2
    y = body_top + round(y_offset_from_body * SOURCE_SCALE)
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    canvas.alpha_composite(scaled, (x, y))
    return canvas


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    layers: dict[str, Image.Image] = {}

    for name, (cell, bounds, _x_offset, y_offset) in CELLS.items():
        part = extract(source, cell, bounds)
        if name == "assembled-reference":
            width = max(1, round(part.width * SOURCE_SCALE))
            height = max(1, round(part.height * SOURCE_SCALE))
            scaled = hard_alpha(part.resize((width, height), Image.Resampling.NEAREST))
            layers[name] = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
            layers[name].alpha_composite(scaled, (CENTER_X - width // 2, BASELINE_Y - height))
        else:
            layers[name] = place(part, y_offset)
        layers[name].save(OUTPUT / f"{name}.png", optimize=True)

    assembled = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    for name in ("hair-back", "body-face-warm", "outfit-navy-mint", "hair-front-indigo"):
        assembled.alpha_composite(layers[name])
    assembled.save(OUTPUT / "assembled-from-layers.png", optimize=True)

    print(f"wrote {len(layers) + 1} aligned assets to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
