"""Highlight covers in the style of the existing white/burgundy set: bold condensed caps, double ring, line-diamond-line.

Usage: python3 design/make_highlights_white.py [out dir]
Writes 1080x1920 PNG + JPG covers and a contact sheet. Text is squeezed horizontally to imitate a condensed face.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

W, H, S = 1080, 1920, 3
BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
WINE, WHITE = (74, 24, 36), (255, 255, 255)
CX, CY = W // 2, H // 2
SQUEEZE = 0.80                       # horizontal scale that makes Liberation Sans Bold look condensed
COVERS = [("gisou", ["GISOU"]), ("boxes", ["БОКСЫ"]), ("new", ["НОВИНКИ"]),
          ("reviews", ["ОТЗЫВЫ"]), ("advent-calendar", ["ADVENT", "CALENDAR"])]

def condensed_line(text, size):
    f = ImageFont.truetype(BOLD, size * S)
    d = ImageDraw.Draw(Image.new("L", (1, 1)))
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    im = Image.new("L", (r - l + 20, b - t + 20), 0)
    ImageDraw.Draw(im).text((10 - l, 10 - t), text, font=f, fill=255)
    return im.resize((int(im.width * SQUEEZE), im.height), Image.LANCZOS)

def cover(lines, out):
    img = Image.new("RGB", (W * S, H * S), WHITE)
    d = ImageDraw.Draw(img)
    for r, w in ((452, 6), (426, 3)):                                    # double ring
        d.ellipse([(CX - r) * S, (CY - r) * S, (CX + r) * S, (CY + r) * S], outline=WINE, width=w * S)
    max_w = 660 * S
    size = 230 if len(lines) == 1 else 150
    ims = [condensed_line(t, size) for t in lines]
    while max(i.width for i in ims) > max_w and size > 40:               # fit the widest line
        size -= 6
        ims = [condensed_line(t, size) for t in lines]
    gap = 30 * S
    total = sum(i.height for i in ims) + gap * (len(ims) - 1)
    y = CY * S - total // 2 - 40 * S
    for i in ims:
        img.paste(Image.new("RGB", i.size, WINE), (CX * S - i.width // 2, y), i)
        y += i.height + gap
    oy = y + 20 * S                                                      # line - diamond - line
    d.line([(CX - 110) * S, oy, (CX - 20) * S, oy], fill=WINE, width=3 * S)
    d.line([(CX + 20) * S, oy, (CX + 110) * S, oy], fill=WINE, width=3 * S)
    d.polygon([(CX * S, oy - 12 * S), (CX * S + 12 * S, oy), (CX * S, oy + 12 * S), (CX * S - 12 * S, oy)], fill=WINE)
    img = img.resize((W, H), Image.LANCZOS)
    img.save(out + ".png")
    img.save(out + ".jpg", quality=96, subsampling=0)
    return img

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "design/highlights-white"
    os.makedirs(out, exist_ok=True)
    imgs = [cover(lines, f"{out}/{i:02d}-{name.lower()}") for i, (name, lines) in enumerate(COVERS, 1)]
    sheet = Image.new("RGB", (5 * 300 + 60, 540 + 20), (12, 16, 24))
    for i, im in enumerate(imgs):
        sheet.paste(im.resize((300, 533), Image.LANCZOS), (10 + i * 310, 10))
    sheet.save(f"{out}/sheet.png")
