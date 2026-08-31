"""Extract the project-owned high-density avatar atlas into aligned runtime layers.

Requires Pillow. The coordinates intentionally stay next to the generated source atlas so
future atlas revisions can be reproduced and reviewed instead of hand-cropping files.
"""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "avatar-parts" / "high-density-atlas-v2-chroma.png"
OUTPUT = ROOT / "public" / "avatar-parts" / "v2"
CANVAS = (256, 384)


LAYERS = {
    "body-light": ((20, 10, 285, 385), (220, 356), "bottom"),
    "body-warm": ((285, 10, 530, 385), (220, 356), "bottom"),
    "body-deep": ((530, 10, 790, 385), (220, 356), "bottom"),
    "hair-short": ((0, 370, 270, 690), (210, 175), "top"),
    "hair-wave": ((250, 370, 510, 690), (210, 185), "top"),
    "hair-bob": ((490, 370, 760, 690), (210, 185), "top"),
    "hair-spike": ((750, 370, 990, 690), (210, 170), "top"),
    "hair-cap": ((980, 370, 1218, 690), (210, 190), "top"),
    "outfit-hoodie": ((0, 660, 290, 1070), (205, 224), "bottom"),
    "outfit-sweater": ((290, 660, 580, 1070), (205, 224), "bottom"),
    "outfit-jacket": ((580, 660, 890, 1070), (205, 224), "bottom"),
    "outfit-overalls": ((890, 660, 1218, 1070), (205, 224), "bottom"),
    "item-laptop": ((0, 1050, 175, 1292), (220, 180), "item"),
    "item-coffee": ((170, 1050, 320, 1292), (170, 180), "item"),
    "item-keyboard": ((480, 1050, 700, 1292), (230, 180), "item"),
    "item-duck": ((680, 1050, 800, 1292), (170, 170), "item"),
    "item-error-log": ((790, 1050, 920, 1292), (170, 180), "item"),
    "item-test-check": ((900, 1050, 1030, 1292), (170, 180), "item"),
    "item-browser-tabs": ((1010, 1050, 1140, 1292), (180, 180), "item"),
    "item-usb": ((1125, 1050, 1218, 1292), (150, 180), "item"),
}


def visible_crop(image: Image.Image, bounds: tuple[int, int, int, int]) -> Image.Image:
    part = image.crop(bounds)
    alpha = part.getchannel("A").point(lambda value: 255 if value > 8 else 0)
    visible = alpha.getbbox()
    if visible is None:
        raise ValueError(f"No visible pixels inside {bounds}")
    return part.crop(visible)


def remove_chroma(image: Image.Image) -> Image.Image:
    """Turn the generated flat lime backdrop and its edge blend into alpha."""
    cleaned = image.copy()
    pixels = []
    for red, green, blue, alpha in cleaned.getdata():
        excess = green - max(red, blue)
        if excess <= 80:
            pixels.append((red, green, blue, alpha))
            continue
        chroma_alpha = round(255 * max(0, 180 - excess) / 100)
        pixels.append((red, min(green, max(red, blue)), blue, min(alpha, chroma_alpha)))
    cleaned.putdata(pixels)
    return cleaned


def fit(part: Image.Image, limits: tuple[int, int]) -> Image.Image:
    scale = min(limits[0] / part.width, limits[1] / part.height)
    size = (max(1, round(part.width * scale)), max(1, round(part.height * scale)))
    return part.resize(size, Image.Resampling.LANCZOS)


def place(part: Image.Image, anchor: str) -> Image.Image:
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    x = (CANVAS[0] - part.width) // 2
    if anchor == "top":
        y = 4
    elif anchor == "item":
        y = 326 - part.height
    else:
        y = 380 - part.height
    canvas.alpha_composite(part, (x, y))
    return canvas


def main() -> None:
    source = remove_chroma(Image.open(SOURCE).convert("RGBA"))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, (bounds, limits, anchor) in LAYERS.items():
        layer = place(fit(visible_crop(source, bounds), limits), anchor)
        layer.save(OUTPUT / f"{name}.png", optimize=True)


if __name__ == "__main__":
    main()
