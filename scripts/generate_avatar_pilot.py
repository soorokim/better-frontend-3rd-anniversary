"""Build the v3 pilot from selected Universal LPC modular character layers.

Only the front-facing frame is exported. The original 64px LPC grid is kept intact, enlarged with
nearest-neighbour sampling, and centered on the project's shared 256x384 canvas. Developer items
remain separate ground props instead of being forced into the character's hands.
"""

from __future__ import annotations

from hashlib import sha256
from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "public" / "avatar-parts" / "vendor" / "universal-lpc" / "spritesheets"
OUTPUT = ROOT / "public" / "avatar-parts" / "v3"
ITEM_SOURCES = OUTPUT / "sources"
CANVAS = (256, 384)
SOURCE_FRAME = 64
SOURCE_SCALE = 5
SOURCE_ORIGIN = (-32, 28)
FRONT_ROW = 2

SKINS = {
    "light": ((88, 43, 40), (220, 143, 103), (255, 216, 181)),
    "warm": ((79, 35, 28), (183, 101, 68), (238, 164, 121)),
    "deep": ((43, 24, 24), (112, 61, 47), (181, 105, 76)),
}
BODY_VARIANTS = {
    "light": [
        ("light", "eyes/human/adult/neutral/default/walk/blue.png"),
        ("light-green", "eyes/human/adult/neutral/default/walk/green.png"),
        ("light-brown", "eyes/human/adult/neutral/default/walk/brown.png"),
    ],
    "warm": [
        ("warm", "eyes/human/adult/neutral/default/walk/green.png"),
        ("warm-brown", "eyes/human/adult/neutral/default/walk/brown.png"),
        ("warm-gray", "eyes/human/adult/neutral/default/walk/gray.png"),
    ],
    "deep": [
        ("deep", "eyes/human/adult/neutral/default/walk/brown.png"),
        ("deep-blue", "eyes/human/adult/neutral/default/walk/blue.png"),
        ("deep-green", "eyes/human/adult/neutral/default/walk/green.png"),
    ],
}
HAIR_VARIANTS = {
    "short": [{
        "id": "short",
        "front": "hair/parted/adult/walk.png",
        "back": None,
        "palette": ((10, 13, 24), (42, 53, 73), (104, 119, 151)),
    }, {
        "id": "short-curtains",
        "front": "hair/curtains/adult/walk.png",
        "back": None,
        "palette": ((42, 20, 12), (119, 69, 34), (213, 155, 78)),
    }, {
        "id": "short-pixie",
        "front": "hair/pixie/adult/walk.png",
        "back": None,
        "palette": ((23, 19, 42), (89, 62, 137), (186, 123, 207)),
    }],
    "wave": [{
        "id": "wave",
        "front": "hair/bob_side_part/adult/walk.png",
        "back": None,
        "palette": ((48, 18, 31), (132, 50, 72), (226, 111, 107)),
    }, {
        "id": "wave-long",
        "front": "hair/wavy/adult/fg/walk.png",
        "back": "hair/wavy/adult/bg/walk.png",
        "palette": ((20, 31, 43), (52, 100, 126), (119, 189, 203)),
    }, {
        "id": "wave-curly",
        "front": "hair/curly_long/adult/walk.png",
        "back": None,
        "palette": ((38, 18, 15), (105, 50, 34), (192, 111, 66)),
    }],
    "bob": [{
        "id": "bob",
        "front": "hair/bob/adult/walk.png",
        "back": None,
        "palette": ((18, 21, 25), (57, 67, 78), (132, 145, 157)),
    }, {
        "id": "bob-lob",
        "front": "hair/lob/adult/walk.png",
        "back": None,
        "palette": ((51, 18, 34), (132, 48, 85), (224, 104, 145)),
    }, {
        "id": "bob-page",
        "front": "hair/page2/adult/walk.png",
        "back": None,
        "palette": ((45, 31, 11), (132, 95, 33), (238, 194, 89)),
    }],
    "spike": [{
        "id": "spike",
        "front": "hair/spiked/adult/walk.png",
        "back": None,
        "palette": ((19, 26, 25), (39, 88, 77), (104, 174, 139)),
    }, {
        "id": "spike-tall",
        "front": "hair/spiked2/adult/walk.png",
        "back": None,
        "palette": ((33, 19, 20), (117, 41, 40), (223, 91, 71)),
    }, {
        "id": "spike-messy",
        "front": "hair/messy3/adult/walk.png",
        "back": None,
        "palette": ((16, 20, 37), (47, 73, 125), (99, 150, 217)),
    }],
    "cap": [{
        "id": "cap",
        "front": "hair/high_ponytail/adult/fg/walk.png",
        "back": "hair/high_ponytail/adult/bg/walk.png",
        "palette": ((31, 20, 58), (102, 60, 135), (188, 125, 211)),
    }, {
        "id": "cap-natural",
        "front": "hair/natural/adult/walk.png",
        "back": None,
        "palette": ((16, 15, 20), (51, 43, 55), (112, 92, 111)),
    }, {
        "id": "cap-dreadlocks",
        "front": "hair/dreadlocks_short/adult/walk.png",
        "back": None,
        "palette": ((39, 21, 13), (108, 62, 30), (184, 123, 59)),
    }],
}
OUTFIT_VARIANTS = {
    "hoodie": [{
        "id": "hoodie",
        "top": "torso/clothes/shortsleeve/tshirt/male/walk.png",
        "bottom": "legs/pants2/male/walk.png",
        "shoes": "feet/shoes/revised/male/walk.png",
        "top_palette": ((48, 22, 33), (177, 58, 84), (255, 130, 142)),
        "bottom_palette": ((18, 27, 50), (41, 64, 103), (91, 116, 159)),
        "shoe_palette": ((56, 49, 61), (156, 150, 157), (246, 241, 228)),
    }, {
        "id": "hoodie-vneck",
        "top": "torso/clothes/shortsleeve/tshirt_vneck/male/walk.png",
        "bottom": "legs/cuffed/male/walk.png",
        "shoes": "feet/shoes/basic/male/walk.png",
        "top_palette": ((12, 42, 40), (44, 133, 115), (111, 218, 175)),
        "bottom_palette": ((20, 22, 29), (61, 65, 78), (130, 136, 148)),
        "shoe_palette": ((29, 22, 44), (80, 64, 119), (153, 126, 199)),
    }, {
        "id": "hoodie-polo",
        "top": "torso/clothes/shortsleeve/shortsleeve_polo/male/walk.png",
        "bottom": "legs/formal/male/walk.png",
        "shoes": "feet/boots/revised/male/walk.png",
        "top_palette": ((55, 40, 9), (174, 127, 29), (255, 224, 87)),
        "bottom_palette": ((17, 25, 46), (49, 68, 110), (102, 125, 168)),
        "shoe_palette": ((42, 22, 14), (115, 65, 38), (193, 126, 72)),
    }],
    "sweater": [{
        "id": "sweater",
        "top": "torso/clothes/longsleeve/longsleeve2_cardigan/male/walk.png",
        "bottom": "legs/pants2/male/walk.png",
        "shoes": "feet/shoes/revised/male/walk.png",
        "top_palette": ((47, 31, 63), (116, 76, 142), (199, 147, 216)),
        "bottom_palette": ((21, 24, 31), (52, 60, 72), (111, 121, 137)),
        "shoe_palette": ((24, 23, 34), (58, 56, 78), (122, 119, 151)),
    }, {
        "id": "sweater-mint",
        "top": "torso/clothes/longsleeve/longsleeve2/male/walk.png",
        "bottom": "legs/cuffed/male/walk.png",
        "shoes": "feet/shoes/basic/male/walk.png",
        "top_palette": ((14, 42, 43), (42, 123, 117), (100, 204, 177)),
        "bottom_palette": ((16, 26, 48), (47, 69, 111), (97, 126, 173)),
        "shoe_palette": ((36, 38, 50), (99, 103, 124), (183, 187, 198)),
    }, {
        "id": "sweater-orange",
        "top": "torso/clothes/longsleeve/longsleeve2_polo/male/walk.png",
        "bottom": "legs/formal/male/walk.png",
        "shoes": "feet/boots/revised/male/walk.png",
        "top_palette": ((55, 25, 11), (171, 75, 29), (243, 147, 67)),
        "bottom_palette": ((19, 19, 24), (55, 54, 63), (116, 114, 127)),
        "shoe_palette": ((19, 18, 24), (55, 52, 67), (113, 106, 131)),
    }],
    "jacket": [{
        "id": "jacket",
        "top": "torso/jacket/collared/male/walk/navy.png",
        "bottom": "legs/pants2/male/walk.png",
        "shoes": "feet/shoes/revised/male/walk.png",
        "top_palette": None,
        "bottom_palette": ((31, 23, 25), (81, 56, 57), (145, 101, 88)),
        "shoe_palette": ((23, 17, 16), (82, 48, 39), (159, 101, 70)),
    }, {
        "id": "jacket-trench",
        "top": "torso/jacket/trench/male/walk/dark_gray.png",
        "bottom": "legs/formal/male/walk.png",
        "shoes": "feet/boots/revised/male/walk.png",
        "top_palette": None,
        "bottom_palette": ((19, 22, 28), (54, 62, 73), (111, 123, 138)),
        "shoe_palette": ((17, 17, 21), (48, 48, 59), (100, 98, 116)),
    }, {
        "id": "jacket-casual",
        "top": "torso/clothes/longsleeve/longsleeve2_cardigan/male/walk.png",
        "bottom": "legs/cuffed/male/walk.png",
        "shoes": "feet/shoes/basic/male/walk.png",
        "top_palette": ((25, 42, 18), (70, 113, 48), (132, 187, 91)),
        "bottom_palette": ((49, 34, 22), (122, 88, 55), (198, 157, 101)),
        "shoe_palette": ((53, 49, 48), (148, 142, 135), (239, 231, 213)),
    }],
    "overalls": [{
        "id": "overalls",
        "top": "torso/clothes/longsleeve/formal/male/walk/white.png",
        "bottom": "legs/pants2/male/walk.png",
        "shoes": "feet/shoes/revised/male/walk.png",
        "top_palette": None,
        "bottom_palette": ((17, 41, 45), (41, 103, 104), (95, 178, 159)),
        "shoe_palette": ((42, 24, 18), (110, 67, 45), (190, 128, 76)),
    }, {
        "id": "overalls-sky",
        "top": "torso/clothes/shortsleeve/tshirt_vneck/male/walk.png",
        "bottom": "legs/formal/male/walk.png",
        "shoes": "feet/boots/revised/male/walk.png",
        "top_palette": ((15, 35, 53), (46, 113, 157), (104, 188, 224)),
        "bottom_palette": ((28, 35, 46), (72, 89, 109), (135, 154, 176)),
        "shoe_palette": ((42, 27, 18), (112, 77, 48), (188, 136, 82)),
    }, {
        "id": "overalls-wine",
        "top": "torso/clothes/shortsleeve/shortsleeve_polo/male/walk.png",
        "bottom": "legs/cuffed/male/walk.png",
        "shoes": "feet/shoes/basic/male/walk.png",
        "top_palette": ((49, 15, 30), (131, 38, 68), (211, 91, 119)),
        "bottom_palette": ((46, 38, 27), (119, 101, 70), (193, 170, 118)),
        "shoe_palette": ((29, 25, 30), (78, 69, 81), (142, 130, 145)),
    }],
}

PILOTS = [
    ("light", "short", "hoodie", "duck"),
    ("deep", "wave", "jacket", "browser-tabs"),
    ("warm", "cap", "overalls", "usb"),
    ("deep", "spike", "sweater", "test-check"),
]

ITEM_LIMITS = {
    "duck": (50, 50),
    "browser-tabs": (62, 52),
    "usb": (36, 48),
    "test-check": (58, 50),
}


def transparent() -> Image.Image:
    return Image.new("RGBA", CANVAS, (0, 0, 0, 0))


def normalize(image: Image.Image) -> Image.Image:
    """Export hard-alpha RGBA so browser scaling cannot reveal translucent edge pixels."""
    source = image.convert("RGBA")
    result = Image.new("RGBA", source.size, (0, 0, 0, 0))
    result.putdata([
        (red, green, blue, 255) if alpha >= 128 else (0, 0, 0, 0)
        for red, green, blue, alpha in source.getdata()
    ])
    return result


def lerp(left: int, right: int, amount: float) -> int:
    return round(left + (right - left) * amount)


def recolor_ramp(
    image: Image.Image,
    palette: tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]],
) -> Image.Image:
    """Map source luminance onto a three-stop palette while retaining LPC pixel shading."""
    source = image.convert("RGBA")
    visible = [(red, green, blue) for red, green, blue, alpha in source.getdata() if alpha]
    if not visible:
        return source
    luminances = [round(red * 0.299 + green * 0.587 + blue * 0.114) for red, green, blue in visible]
    low_luma, high_luma = min(luminances), max(luminances)
    span = max(1, high_luma - low_luma)
    low, middle, high = palette
    output = []
    for red, green, blue, alpha in source.getdata():
        if not alpha:
            output.append((0, 0, 0, 0))
            continue
        amount = (red * 0.299 + green * 0.587 + blue * 0.114 - low_luma) / span
        if amount <= 0.5:
            local = amount * 2
            color = tuple(lerp(low[index], middle[index], local) for index in range(3))
        else:
            local = (amount - 0.5) * 2
            color = tuple(lerp(middle[index], high[index], local) for index in range(3))
        output.append((*color, alpha))
    result = Image.new("RGBA", source.size)
    result.putdata(output)
    return result


def sheet_frame(
    filename: str,
    frame: int = 0,
    palette: tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]] | None = None,
) -> Image.Image:
    """Select one aligned 64x64 LPC layer and place it on the common v3 canvas."""
    with Image.open(VENDOR / filename).convert("RGBA") as sheet:
        left = frame * SOURCE_FRAME
        top = FRONT_ROW * SOURCE_FRAME
        if left + SOURCE_FRAME > sheet.width or top + SOURCE_FRAME > sheet.height:
            raise ValueError(f"Frame outside {filename}: row={FRONT_ROW}, frame={frame}, size={sheet.size}")
        part = sheet.crop((left, top, left + SOURCE_FRAME, top + SOURCE_FRAME))
    if palette is not None:
        part = recolor_ramp(part, palette)
    part = normalize(part).resize(
        (SOURCE_FRAME * SOURCE_SCALE, SOURCE_FRAME * SOURCE_SCALE),
        Image.Resampling.NEAREST,
    )
    result = transparent()
    result.alpha_composite(part, SOURCE_ORIGIN)
    return result


def body_with_eyes(skin_id: str, eye_path: str) -> Image.Image:
    result = sheet_frame("body/bodies/male/walk.png", palette=SKINS[skin_id])
    result.alpha_composite(sheet_frame("head/heads/human/male/walk.png", palette=SKINS[skin_id]))
    result.alpha_composite(sheet_frame(eye_path))
    return result


def outfit(selection: dict[str, object]) -> Image.Image:
    result = transparent()
    for filename, palette in (
        (selection["shoes"], selection["shoe_palette"]),
        (selection["bottom"], selection["bottom_palette"]),
        (selection["top"], selection["top_palette"]),
    ):
        result.alpha_composite(sheet_frame(filename, palette=palette))
    return result


def drawn_ground_item(item_id: str) -> Image.Image:
    """Draw compact hand-free developer props on a 64x96 logical pixel grid."""
    logical = Image.new("RGBA", (64, 96), (0, 0, 0, 0))
    draw = ImageDraw.Draw(logical)
    ink = "#11162b"
    if item_id == "coffee":
        draw.rectangle((48, 75, 58, 87), fill=ink)
        draw.rectangle((50, 76, 56, 85), fill="#f4f0e8")
        draw.rectangle((50, 76, 56, 79), fill="#7f4d31")
        draw.rectangle((58, 78, 61, 84), fill=ink)
        draw.rectangle((58, 79, 59, 82), fill="#d99c65")
        draw.line((51, 72, 53, 69), fill="#62d5aa", width=1)
        draw.line((55, 72, 56, 68), fill="#62d5aa", width=1)
    elif item_id == "keyboard":
        draw.rectangle((42, 80, 61, 89), fill=ink)
        draw.rectangle((44, 81, 59, 86), fill="#817a9c")
        for y in (82, 85):
            for x in range(45, 59, 3):
                draw.point((x, y), fill="#ffe657")
        draw.rectangle((47, 88, 57, 89), fill="#343f68")
    elif item_id == "laptop":
        draw.rectangle((44, 69, 60, 84), fill=ink)
        draw.rectangle((46, 71, 58, 81), fill="#172449")
        draw.rectangle((48, 73, 56, 79), fill="#62b8e9")
        draw.line((49, 77, 52, 75, 55, 77), fill="#f4f0e8", width=1)
        draw.polygon(((42, 84), (62, 84), (59, 89), (45, 89)), fill=ink)
        draw.rectangle((47, 85, 57, 86), fill="#817a9c")
    elif item_id == "error-log":
        draw.rectangle((48, 71, 60, 89), fill=ink)
        draw.rectangle((50, 72, 58, 87), fill="#b93f55")
        draw.rectangle((52, 75, 56, 76), fill="#f4f0e8")
        draw.rectangle((52, 79, 56, 80), fill="#ffe657")
        draw.rectangle((53, 82, 55, 85), fill="#f4f0e8")
    else:
        raise ValueError(f"Unknown drawn item: {item_id}")
    return normalize(logical.resize(CANVAS, Image.Resampling.NEAREST))


def object_only(item_id: str, image: Image.Image) -> Image.Image:
    """Keep project-specific developer items separate from the character silhouette."""
    image = normalize(image)
    box = image.getchannel("A").getbbox()
    if box is None:
        raise ValueError(f"No object pixels found for {item_id}")
    obj = image.crop(box)
    limit_width, limit_height = ITEM_LIMITS[item_id]
    scale = min(limit_width / obj.width, limit_height / obj.height)
    obj = obj.resize(
        (max(1, round(obj.width * scale)), max(1, round(obj.height * scale))),
        Image.Resampling.NEAREST,
    )
    result = transparent()
    result.alpha_composite(obj, (250 - obj.width, 354 - obj.height))
    return result


def save(image: Image.Image, path: Path) -> None:
    normalize(image).save(path, optimize=True)


def visible_bounds(image: Image.Image) -> tuple[int, int, int, int] | None:
    box = image.getchannel("A").getbbox()
    if box is None:
        return None
    left, top, right, bottom = box
    return left, top, right - left, bottom - top


def mask(bounds: tuple[int, int, int, int]) -> Image.Image:
    image = transparent()
    left, top, right, bottom = bounds
    ImageDraw.Draw(image).rectangle((left, top, right - 1, bottom - 1), fill=(255, 255, 255, 255))
    return image


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "validation").mkdir(parents=True, exist_ok=True)
    generated: dict[str, Image.Image] = {}

    for skin_id, variants in BODY_VARIANTS.items():
        for output_id, eye_path in variants:
            generated[f"body-{output_id}"] = body_with_eyes(skin_id, eye_path)
    for variants in HAIR_VARIANTS.values():
        for selection in variants:
            hair_id = selection["id"]
            generated[f"hair-{hair_id}-back"] = (
                sheet_frame(selection["back"], palette=selection["palette"])
                if selection["back"]
                else transparent()
            )
            generated[f"hair-{hair_id}-front"] = sheet_frame(
                selection["front"], palette=selection["palette"]
            )
    for variants in OUTFIT_VARIANTS.values():
        for selection in variants:
            generated[f"outfit-{selection['id']}"] = outfit(selection)
    for item_id in ITEM_LIMITS:
        with Image.open(ITEM_SOURCES / f"item-{item_id}-source.png") as source:
            generated[f"item-{item_id}"] = object_only(item_id, source)
    for item_id in ("coffee", "keyboard", "laptop", "error-log"):
        generated[f"item-{item_id}"] = drawn_ground_item(item_id)

    for name, image in generated.items():
        save(image, OUTPUT / f"{name}.png")

    # The face and torso masks are shared checks for the selected front-facing LPC frame.
    save(mask((118, 168, 148, 173)), OUTPUT / "validation" / "face-mask.png")
    save(mask((82, 168, 174, 298)), OUTPUT / "validation" / "torso-mask.png")

    fallback = transparent()
    for name in ("body-warm", "outfit-hoodie", "hair-short-front"):
        fallback.alpha_composite(generated[name])
    save(fallback, OUTPUT / "fallback-default.png")

    sheet = Image.new("RGBA", (CANVAS[0] * len(PILOTS), CANVAS[1]), "#111a3a")
    for index, (skin_id, hair_id, outfit_id, item_id) in enumerate(PILOTS):
        preview = transparent()
        for name in (f"body-{skin_id}", f"outfit-{outfit_id}", f"hair-{hair_id}-front", f"item-{item_id}"):
            preview.alpha_composite(generated[name])
        sheet.alpha_composite(preview, (index * CANVAS[0], 0))
    review_dir = ROOT / "specs" / "005-rebuild-avatar-parts" / "validation"
    review_dir.mkdir(parents=True, exist_ok=True)
    sheet.save(review_dir / "pilot-contact-sheet.png", optimize=True)

    hair_sheet = Image.new("RGBA", (CANVAS[0] * 3, CANVAS[1] * 5), "#111a3a")
    for row, variants in enumerate(HAIR_VARIANTS.values()):
        for column, selection in enumerate(variants):
            preview = transparent()
            preview.alpha_composite(generated["body-warm"])
            preview.alpha_composite(generated["outfit-hoodie"])
            preview.alpha_composite(generated[f"hair-{selection['id']}-front"])
            hair_sheet.alpha_composite(preview, (column * CANVAS[0], row * CANVAS[1]))
    hair_sheet.save(review_dir / "hair-catalog-contact-sheet.png", optimize=True)

    outfit_sheet = Image.new("RGBA", (CANVAS[0] * 3, CANVAS[1] * 4), "#111a3a")
    for row, variants in enumerate(OUTFIT_VARIANTS.values()):
        for column, selection in enumerate(variants):
            preview = transparent()
            preview.alpha_composite(generated["body-light"])
            preview.alpha_composite(generated[f"outfit-{selection['id']}"])
            preview.alpha_composite(generated["hair-short-front"])
            outfit_sheet.alpha_composite(preview, (column * CANVAS[0], row * CANVAS[1]))
    outfit_sheet.save(review_dir / "outfit-catalog-contact-sheet.png", optimize=True)

    item_sheet = Image.new("RGBA", (CANVAS[0] * 4, CANVAS[1] * 2), "#111a3a")
    for index, item_id in enumerate(("duck", "coffee", "keyboard", "laptop", "error-log", "test-check", "browser-tabs", "usb")):
        preview = transparent()
        preview.alpha_composite(generated["body-deep"])
        preview.alpha_composite(generated["outfit-sweater-mint"])
        preview.alpha_composite(generated["hair-spike-messy-front"])
        preview.alpha_composite(generated[f"item-{item_id}"])
        item_sheet.alpha_composite(preview, ((index % 4) * CANVAS[0], (index // 4) * CANVAS[1]))
    item_sheet.save(review_dir / "item-catalog-contact-sheet.png", optimize=True)

    for file_path in sorted(OUTPUT.rglob("*.png")):
        with Image.open(file_path).convert("RGBA") as image:
            print(
                f"{file_path.relative_to(ROOT).as_posix()}\t"
                f"{sha256(file_path.read_bytes()).hexdigest()}\t{visible_bounds(image)}"
            )


if __name__ == "__main__":
    main()
