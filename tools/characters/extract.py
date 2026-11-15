#!/usr/bin/env python3
"""Cut a figure out of a scanned Chōjū-giga page and turn it into the app's
template layers.

Each figure in figures.json says which scan to read, the crop box around
the figure, and optional accessories (the orange scarf, the walking stick)
drawn as SVG in the crop's pixel coordinates. The output replaces
SatsOS/Resources/Assets.xcassets/char-<name>-{ink,paper,accent}.imageset:

  ink    – the brush lines; the alpha keeps the ink's light and dark (薄墨)
  paper  – the filled silhouette, so the body hides what is behind it
  accent – orange accessories (optional)

usage: python3 tools/characters/extract.py [name ...]
Needs Pillow, numpy and scipy. Accessories are rendered with the
preinstalled Playwright (NODE_PATH=$(npm root -g)).

Source scans: ColBase (https://colbase.nich.go.jp/), Tokyo National Museum,
鳥獣戯画（模本） 山崎董詮模 (A-1530). Free to use with credit; the figures are
cropped, cleaned and recoloured (加工) for the app.
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
ASSETS = Path(os.environ.get("CHOJU_ASSETS", HERE.parent.parent / "SatsOS/Resources/Assets.xcassets"))
SOURCES = Path(os.environ.get("CHOJU_SOURCES", HERE / "source"))
TARGET_HEIGHT = 720  # px; the app shows characters up to ~240 pt tall


def ink_alpha(gray: np.ndarray, cut: float, gamma: float) -> np.ndarray:
    """0..1 ink strength from a grayscale scan, paper removed."""
    paper = np.percentile(gray, 92)
    darkest = np.percentile(gray, 0.5)
    strength = (paper - gray) / max(paper - darkest, 1)
    strength = np.clip((strength - cut) / (1 - cut), 0, 1)
    return strength ** gamma


def main_region(alpha: np.ndarray, keep: list | None) -> np.ndarray:
    """Mask of the figure: the biggest blob of ink (plus any blob touching a
    `keep` box), so neighbouring figures in the crop are dropped."""
    solid = ndimage.binary_dilation(alpha > 0.25, iterations=6)
    labels, count = ndimage.label(solid)
    if count == 0:
        return np.zeros_like(solid)
    sizes = ndimage.sum(solid, labels, range(1, count + 1))
    chosen = {int(np.argmax(sizes)) + 1}
    for box in keep or []:
        x, y, w, h = box
        chosen |= {int(v) for v in np.unique(labels[y:y + h, x:x + w]) if v}
    return np.isin(labels, list(chosen))


def silhouette(alpha: np.ndarray, region: np.ndarray, close: int) -> np.ndarray:
    lines = (alpha > 0.3) & region
    closed = ndimage.binary_closing(lines, iterations=close)
    filled = ndimage.binary_fill_holes(closed)
    filled = ndimage.binary_erosion(filled, iterations=2)
    soft = ndimage.gaussian_filter(filled.astype(float), 1.2)
    return np.clip(soft, 0, 1)


def render_svg(svg: str, size: tuple[int, int]) -> np.ndarray:
    """Render an SVG (crop pixel coordinates) to a 0..1 alpha array."""
    w, h = size
    with tempfile.TemporaryDirectory() as tmp:
        svg_path = Path(tmp) / "a.svg"
        png_path = Path(tmp) / "a.png"
        svg_path.write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{svg}</svg>'
        )
        script = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const b = await chromium.launch();
  const p = await b.newPage({{ viewport: {{ width: {w}, height: {h} }} }});
  await p.goto('file://{svg_path}');
  await p.screenshot({{ path: '{png_path}', omitBackground: true }});
  await b.close();
}})();"""
        env = dict(os.environ)
        env.setdefault("NODE_PATH", subprocess.check_output(["npm", "root", "-g"], text=True).strip())
        subprocess.run(["node", "-e", script], check=True, env=env)
        return np.asarray(Image.open(png_path).convert("RGBA"))[..., 3] / 255.0


def write_layer(name: str, layer: str, alpha: np.ndarray) -> None:
    img = Image.new("L", (alpha.shape[1], alpha.shape[0]), 0)
    rgba = Image.merge("RGBA", (img, img, img, Image.fromarray((alpha * 255).astype(np.uint8))))
    scale = TARGET_HEIGHT / rgba.height
    rgba = rgba.resize((round(rgba.width * scale), TARGET_HEIGHT), Image.LANCZOS)
    folder = ASSETS / f"char-{name}-{layer}.imageset"
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob("*.png"):
        old.unlink()
    rgba.save(folder / f"char-{name}-{layer}.png", optimize=True)
    (folder / "Contents.json").write_text(json.dumps({
        "images": [{"filename": f"char-{name}-{layer}.png", "idiom": "universal", "scale": "3x"}],
        "info": {"author": "xcode", "version": 1},
        "properties": {"template-rendering-intent": "template"},
    }, indent=2) + "\n")


def remove_layer(name: str, layer: str) -> None:
    folder = ASSETS / f"char-{name}-{layer}.imageset"
    if folder.exists():
        for f in folder.iterdir():
            f.unlink()
        folder.rmdir()


def build(name: str, spec: dict) -> None:
    scan = Image.open(SOURCES / spec["source"]).convert("L")
    x, y, w, h = spec["crop"]
    crop = scan.crop((x, y, x + w, y + h))
    if spec.get("flip"):
        crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
    gray = np.asarray(crop, dtype=float)

    alpha = ink_alpha(gray, spec.get("cut", 0.18), spec.get("gamma", 0.9))
    region = main_region(alpha, spec.get("keep"))
    alpha = alpha * ndimage.binary_dilation(region, iterations=3)

    if spec.get("ink_svg"):
        alpha = np.maximum(alpha, render_svg(spec["ink_svg"], (w, h)))
    write_layer(name, "ink", alpha)
    write_layer(name, "paper", silhouette(alpha, region | (alpha > 0.3), spec.get("close", 5)))
    if spec.get("accent_svg"):
        write_layer(name, "accent", render_svg(spec["accent_svg"], (w, h)))
    else:
        remove_layer(name, "accent")
    remove_layer(name, "wash")  # the scan's own ink carries the wash
    print(f"char-{name}: {w}x{h} from {spec['source']}")


def main() -> None:
    figures = json.loads((HERE / "figures.json").read_text())
    wanted = sys.argv[1:] or [k for k in figures if not k.startswith("_")]
    for name in wanted:
        build(name, figures[name])


if __name__ == "__main__":
    main()
