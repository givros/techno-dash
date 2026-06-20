import json
import math
import re
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "src" / "game" / "DecorCatalog.js"
DECOR_DIR = ROOT / "assets" / "decor"
ATLAS_DIR = ROOT / "assets" / "decor-atlas"
PADDING = 2
MAX_ATLAS_WIDTH = 1024


def next_power_of_two(value):
    return 1 if value <= 1 else 2 ** math.ceil(math.log2(value))


def read_catalog():
    content = CATALOG_PATH.read_text(encoding="utf-8")
    theme_pattern = re.compile(r"^\s{4}([a-z]+): \[$", re.MULTILINE)
    item_pattern = re.compile(
        r"\['([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(\d+)\]"
    )

    themes = {}
    current_theme = None
    for line in content.splitlines():
        theme_match = theme_pattern.match(line)
        if theme_match:
            current_theme = theme_match.group(1)
            themes[current_theme] = []
            continue

        if current_theme:
            item_match = item_pattern.search(line)
            if item_match:
                decor_type, label, filename, width_tiles, height_tiles = item_match.groups()
                themes[current_theme].append({
                    "type": decor_type,
                    "label": label,
                    "file": filename,
                    "widthTiles": int(width_tiles),
                    "heightTiles": int(height_tiles),
                })
            elif line.strip() == "],":
                current_theme = None

    return themes


def pack_theme(theme, items):
    source_images = []
    for item in items:
        image_path = DECOR_DIR / item["file"]
        with Image.open(image_path) as image:
            source_images.append((item, image.convert("RGBA")))

    source_images.sort(key=lambda entry: (entry[1].height, entry[1].width), reverse=True)

    x = PADDING
    y = PADDING
    row_height = 0
    atlas_width = MAX_ATLAS_WIDTH
    placements = []
    for item, image in source_images:
        if x + image.width + PADDING > atlas_width:
            x = PADDING
            y += row_height + PADDING
            row_height = 0

        placements.append((item, image, x, y))
        x += image.width + PADDING
        row_height = max(row_height, image.height)

    content_width = max((x + image.width for _, image, x, _ in placements), default=PADDING)
    content_height = max((y + image.height for _, image, _, y in placements), default=PADDING)
    final_width = next_power_of_two(min(MAX_ATLAS_WIDTH, max(1, content_width + PADDING)))
    final_height = next_power_of_two(max(1, content_height + PADDING))

    atlas = Image.new("RGBA", (final_width, final_height), (0, 0, 0, 0))
    frames = {}
    for item, image, frame_x, frame_y in placements:
        atlas.alpha_composite(image, (frame_x, frame_y))
        frames[item["type"]] = {
            "frame": {
                "x": frame_x,
                "y": frame_y,
                "w": image.width,
                "h": image.height,
            },
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {
                "x": 0,
                "y": 0,
                "w": image.width,
                "h": image.height,
            },
            "sourceSize": {
                "w": image.width,
                "h": image.height,
            },
        }

    ATLAS_DIR.mkdir(parents=True, exist_ok=True)
    image_name = f"decor-{theme}.png"
    json_name = f"decor-{theme}.json"
    atlas.save(ATLAS_DIR / image_name, optimize=True)
    (ATLAS_DIR / json_name).write_text(
        json.dumps({
            "frames": frames,
            "meta": {
                "app": "technoDash",
                "image": image_name,
                "format": "RGBA8888",
                "size": {"w": final_width, "h": final_height},
                "scale": "1",
            },
        }, indent=2),
        encoding="utf-8",
    )

    return {
        "theme": theme,
        "items": len(items),
        "image": str(ATLAS_DIR / image_name),
        "json": str(ATLAS_DIR / json_name),
        "size": [final_width, final_height],
    }


def main():
    catalog = read_catalog()
    results = [pack_theme(theme, items) for theme, items in catalog.items()]
    for result in results:
        print(
            f"{result['theme']}: {result['items']} frames "
            f"{result['size'][0]}x{result['size'][1]}"
        )


if __name__ == "__main__":
    main()
