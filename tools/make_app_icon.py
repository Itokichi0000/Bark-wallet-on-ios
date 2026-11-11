#!/usr/bin/env python3
"""Generate the 1024x1024 app icon from the bitty sprite in Sats-OS colors.

usage: python3 tools/make_app_icon.py <bitty.png> <out.png>
"""
import sys
from PIL import Image, ImageDraw

SIZE = 1024
BG_HI = (42, 32, 20)      # --bg-hi
BG_LO = (12, 9, 6)        # --bg-lo
ENCRE = (247, 147, 26)    # --encre (bitcoin orange)
BRAISE = (217, 72, 28)    # --braise (hard shadow)
GRID = (42, 29, 16)       # --grid


def main(src: str, out: str) -> None:
    icon = Image.new("RGB", (SIZE, SIZE), BG_LO)
    px = icon.load()
    # radial vignette, quantised into 8 px blocks for a chunky CRT feel
    cx = cy = SIZE / 2
    maxd = (cx ** 2 + cy ** 2) ** 0.5
    for by in range(0, SIZE, 8):
        for bx in range(0, SIZE, 8):
            d = (((bx + 4 - cx) ** 2 + (by + 4 - cy) ** 2) ** 0.5) / maxd
            t = min(1.0, d * 1.25)
            c = tuple(int(BG_HI[i] * (1 - t) + BG_LO[i] * t) for i in range(3))
            for y in range(by, by + 8):
                for x in range(bx, bx + 8):
                    px[x, y] = c
    draw = ImageDraw.Draw(icon)
    # scanlines
    for y in range(0, SIZE, 8):
        draw.rectangle([0, y + 6, SIZE, y + 7], fill=tuple(max(0, v - 8) for v in BG_LO))
    # dotted grid floor
    for y in range(704, SIZE, 32):
        for x in range(0, SIZE, 32):
            draw.rectangle([x, y, x + 3, y + 3], fill=GRID)

    bitty = Image.open(src).convert("RGBA")
    scale = 13
    big = bitty.resize((bitty.width * scale, bitty.height * scale), Image.NEAREST)
    ox = (SIZE - big.width) // 2
    oy = (SIZE - big.height) // 2 - 10
    # hard pixel shadow like the website's `box-shadow: 6px 6px 0 var(--braise)`
    shadow = Image.new("RGBA", big.size, BRAISE + (255,))
    shadow.putalpha(big.getchannel("A").point(lambda a: 150 if a > 128 else 0))
    icon.paste(shadow, (ox + 26, oy + 26), shadow)
    icon.paste(big, (ox, oy), big)
    icon.save(out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
