"""Beige "Ivory Atelier" Reels cover for the daily-makeup / skin reel (2160x3840 by default).

Usage: python3 design/make_daily_makeup_cover.py <screenshot> [out.jpg] [scale]
Two edge-to-edge frames are cropped from the reel screenshot (589x1280), avoiding the Instagram UI on the right and bottom.
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_IT = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
INK, TAUPE, BRASS = (58, 42, 34), (140, 118, 98), (176, 145, 96)
FRAMES = [((0, 142, 522, 388), (1080, 509)), ((0, 792, 522, 1012), (1080, 455))]   # crop box, tile size (1080 units)
TILE_X, TILE_Y = 0, [640, 1175]

def tile(path, box, w, h):
    crop = cv2.imread(path)[box[1]:box[3], box[0]:box[2]]
    big = cv2.resize(cv2.bilateralFilter(cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC), 5, 20, 5),
                     (w, h), interpolation=cv2.INTER_LANCZOS4)
    lab = cv2.cvtColor(big, cv2.COLOR_BGR2LAB)
    lab[..., 0] = cv2.createCLAHE(1.1, (6, 6)).apply(lab[..., 0])
    img = Image.fromarray(cv2.cvtColor(cv2.cvtColor(lab, cv2.COLOR_LAB2BGR), cv2.COLOR_BGR2RGB))
    return img.filter(ImageFilter.UnsharpMask(3, 110, 2)).filter(ImageFilter.UnsharpMask(1, 50, 1))

def main(src, out, s):
    W, H = 1080 * s, 1920 * s
    t = np.linspace(0, 1, H)[:, None, None]
    yy, xx = np.mgrid[0:H, 0:W]
    glow = np.clip(1 - np.hypot((xx - W / 2) / (W * 0.75), (yy - H * 0.52) / (H * 0.45)), 0, 1)[..., None] ** 1.6
    col = (np.array((236, 226, 211)) * (1 - t) + np.array((222, 206, 186)) * t) * (1 - glow) + np.array((249, 243, 233)) * glow
    col = col + np.random.default_rng(8).normal(0, 2, (H, W, 1))
    img = Image.fromarray(np.clip(col, 0, 255).astype("uint8")).convert("RGBA")
    for (box, (tw, th)), ty in zip(FRAMES, TILE_Y):
        x, y, w, h = TILE_X * s, ty * s, tw * s, th * s
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rectangle((x, y + 14 * s, x + w, y + h + 14 * s), fill=(90, 66, 46, 90))
        img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(20 * s)))
        img.paste(tile(src, box, w, h), (x, y))
    d = ImageDraw.Draw(img)
    def font(n, size): return ImageFont.truetype(n, size * s)
    def spaced(cx, y, text, f, fill, track):
        widths = [d.textlength(c, font=f) for c in text]
        x = cx - (sum(widths) + track * s * (len(text) - 1)) / 2
        for c, w in zip(text, widths):
            d.text((x, y * s), c, font=f, fill=fill)
            x += w + track * s
    def ornament(y):
        d.line((W / 2 - 110 * s, y * s, W / 2 - 16 * s, y * s), fill=BRASS, width=2 * s)
        d.line((W / 2 + 16 * s, y * s, W / 2 + 110 * s, y * s), fill=BRASS, width=2 * s)
        d.polygon([(W / 2, (y - 7) * s), (W / 2 + 7 * s, y * s), (W / 2, (y + 7) * s), (W / 2 - 7 * s, y * s)], fill=INK)
    spaced(W / 2, 100, "FLANER COSMETICS", font(SERIF, 24), TAUPE, 14)
    d.text((W / 2, 165 * s), "daily", font=font(SERIF_IT, 96), fill=BRASS, anchor="ma")
    spaced(W / 2, 285, "MAKEUP", font(SERIF, 118), INK, 40)
    ornament(470)
    d.text((W / 2, 495 * s), "кожа, которая выглядит дорого", font=font(SERIF_IT, 46), fill=TAUPE, anchor="ma")
    ornament(1735)
    spaced(W / 2, 1765, "СМОТРЕТЬ РИЛС", font(SERIF, 26), INK, 14)
    img.convert("RGB").save(out, quality=96, subsampling=0, dpi=(300, 300))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "design/daily-makeup-cover.jpg",
         int(sys.argv[3]) if len(sys.argv) > 3 else 2)
