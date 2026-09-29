"""Light "Ivory Atelier" Reels cover for the NARS blushes, rendered at 4K (2160x3840).

Usage: python3 design/make_nars_cover.py <photo> [out.png] [scale]
scale 1 gives 1080x1920, scale 2 (default) gives 2160x3840. Crop box is tuned for the 589x1280 screenshot.
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_IT = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
BG_TOP, BG_BOT = (241, 233, 220), (232, 220, 203)
INK, TAUPE, BRASS = (58, 42, 34), (140, 118, 98), (176, 145, 96)
CROP = (0, 250, 520, 990)
TILE = (860, 1210)              # in 1080x1920 units
TILE_XY = (110, 505)

def enhance(path, box, size):
    bgr = cv2.imread(path)
    crop = bgr[box[1]:box[3], box[0]:box[2]]
    mid = cv2.bilateralFilter(cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC), 5, 22, 5)
    big = cv2.resize(mid, size, interpolation=cv2.INTER_LANCZOS4)
    lab = cv2.cvtColor(big, cv2.COLOR_BGR2LAB)
    lab[..., 0] = cv2.createCLAHE(1.3, (6, 6)).apply(lab[..., 0])
    img = Image.fromarray(cv2.cvtColor(cv2.cvtColor(lab, cv2.COLOR_LAB2BGR), cv2.COLOR_BGR2RGB))
    return img.filter(ImageFilter.UnsharpMask(3, 120, 2)).filter(ImageFilter.UnsharpMask(1, 60, 1))

def main(src, out, s):
    W, H = 1080 * s, 1920 * s
    t = np.linspace(0, 1, H)[:, None, None]
    col = np.array(BG_TOP) * (1 - t) + np.array(BG_BOT) * t + np.random.default_rng(4).normal(0, 2.2, (H, W, 1))
    img = Image.fromarray(np.clip(np.broadcast_to(col, (H, W, 3)), 0, 255).astype("uint8")).convert("RGBA")

    tw, th, (tx, ty) = TILE[0] * s, TILE[1] * s, (TILE_XY[0] * s, TILE_XY[1] * s)
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((tx + 8 * s, ty + 16 * s, tx + tw + 8 * s, ty + th + 16 * s), fill=(70, 50, 36, 70))
    img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(18 * s)))
    img.paste(enhance(src, CROP, (tw, th)), (tx, ty))

    d = ImageDraw.Draw(img)
    def font(name, size): return ImageFont.truetype(name, size * s)
    def spaced(y, text, f, fill, track):
        widths = [d.textlength(c, font=f) for c in text]
        x = W / 2 - (sum(widths) + track * s * (len(text) - 1)) / 2
        for c, w in zip(text, widths):
            d.text((x, y * s), c, font=f, fill=fill)
            x += w + track * s
    spaced(110, "FLANER COSMETICS", font(SERIF, 24), TAUPE, 14)
    spaced(190, "NARS", font(SERIF, 150), INK, 48)
    d.line((W / 2 - 60 * s, 385 * s, W / 2 + 60 * s, 385 * s), fill=BRASS, width=2 * s)
    d.text((W / 2, 412 * s), "румяна и хайлайтеры", font=font(SERIF_IT, 52), fill=TAUPE, anchor="ma")
    d.line((W / 2 - 60 * s, 1795 * s, W / 2 + 60 * s, 1795 * s), fill=BRASS, width=2 * s)
    spaced(1822, "СМОТРЕТЬ ОБЗОР", font(SERIF, 26), INK, 14)
    img.convert("RGB").save(out, quality=97, subsampling=0, dpi=(300, 300))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "design/nars-cover-4k.png",
         int(sys.argv[3]) if len(sys.argv) > 3 else 2)
