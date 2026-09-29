"""Full-bleed dark-gradient Reels covers (same format as the muted YSL cover) for Rituals and NARS.

Usage: python3 design/make_fullbleed_covers.py <images dir> [out dir] [scale]
scale 2 (default) writes 2160x3840; scale 1 writes 1080x1920.
Crop boxes are tuned for the shop photos: Rituals 5-8.jpg (960x1280) and the NARS screenshot 9.jpg (589x1280).
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_IT = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
CREAM, CHAMP_TOP, CHAMP_BOT = (245, 236, 218), (236, 224, 200), (205, 186, 154)

COVERS = [  # out name, photo, crop box, title, italic line, saturation
    ("rituals-sakura", "5.jpg", (110, -120, 830, 1160), "RITUALS", "The Ritual of Sakura", 0.85),
    ("rituals-ayurveda", "6.jpg", (60, -120, 780, 1160), "RITUALS", "The Ritual of Ayurveda", 0.85),
    ("rituals-karma", "7.jpg", (80, -120, 800, 1160), "RITUALS", "The Ritual of Karma", 0.85),
    ("rituals-homme", "8.jpg", (100, -120, 820, 1160), "RITUALS", "Homme", 0.85),
    ("nars", "9.jpg", (30, 138, 520, 1005), "NARS", "Румяна и хайлайтеры", 0.90),
]

def photo(path, box, W, H, sat):
    bgr = cv2.imread(path)
    pad = max(0, -box[1])                                   # negative y0 = extend the top by mirroring
    if pad:
        bgr = cv2.copyMakeBorder(bgr, pad, 0, 0, 0, cv2.BORDER_REFLECT)
    crop = bgr[box[1] + pad:box[3] + pad, box[0]:box[2]]
    mid = cv2.bilateralFilter(cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC), 5, 22, 5)
    big = cv2.resize(mid, (W, H), interpolation=cv2.INTER_LANCZOS4)
    lab = cv2.cvtColor(big, cv2.COLOR_BGR2LAB)
    lab[..., 0] = cv2.createCLAHE(1.2, (6, 6)).apply(lab[..., 0])
    hsv = cv2.cvtColor(cv2.cvtColor(lab, cv2.COLOR_LAB2BGR), cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] *= sat
    hsv[..., 2] *= 0.90
    big = cv2.cvtColor(np.clip(hsv, 0, 255).astype("uint8"), cv2.COLOR_HSV2BGR).astype(np.float32)
    big = np.clip((big - 128) * 1.04 + 112, 0, 255)
    img = Image.fromarray(cv2.cvtColor(big.astype("uint8"), cv2.COLOR_BGR2RGB))
    return img.filter(ImageFilter.UnsharpMask(3, 130, 2)).filter(ImageFilter.UnsharpMask(1, 60, 1))

def gradient(W, H, s):
    r = np.arange(H)
    top = np.clip(1 - r / (900 * s), 0, 1) ** 1.4 * 0.97
    bot = np.clip((r - (H - 760 * s)) / (760 * s), 0, 1) ** 1.3 * 0.95
    a = np.maximum(top, bot)[:, None] * np.ones((1, W), np.float32)
    yy, xx = np.mgrid[0:H, 0:W]
    a = np.clip(a + np.clip(np.hypot((xx - W / 2) / W, (yy - H / 2) / H) - 0.35, 0, 1) * 0.45, 0, 1)
    layer = Image.new("RGBA", (W, H), (26, 20, 16, 0))
    layer.putalpha(Image.fromarray((a * 255).astype("uint8")))
    return layer

def render(src, box, title, line, sat, s, out):
    W, H = 1080 * s, 1920 * s
    img = Image.alpha_composite(photo(src, box, W, H, sat).convert("RGBA"), gradient(W, H, s))
    d = ImageDraw.Draw(img)
    def font(name, size): return ImageFont.truetype(name, size * s)
    def spaced(draw, y, text, f, fill, track):
        widths = [draw.textlength(c, font=f) for c in text]
        x = W / 2 - (sum(widths) + track * s * (len(text) - 1)) / 2
        for c, w in zip(text, widths):
            draw.text((x, y * s), c, font=f, fill=fill)
            x += w + track * s
    def shadowed(y, text, f, fill, track):
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        spaced(ImageDraw.Draw(sh), y + 2, text, f, (0, 0, 0, 200), track)
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5 * s)))
        spaced(ImageDraw.Draw(img), y, text, f, fill, track)
    shadowed(80, "FLANER COSMETICS", font(SERIF, 30), CREAM, 12)
    f = font(SERIF, 230 if len(title) < 6 else 150)                      # title as a champagne gradient
    mask = Image.new("L", (W, H), 0)
    spaced(ImageDraw.Draw(mask), 190 if len(title) < 6 else 205, title, f, 255, 40 if len(title) < 6 else 22)
    bb = mask.getbbox()
    grad = Image.new("RGB", (W, H))
    gd = ImageDraw.Draw(grad)
    for y in range(bb[1], bb[3] + 1):
        k = (y - bb[1]) / max(1, bb[3] - bb[1])
        gd.line((0, y, W, y), fill=tuple(int(CHAMP_TOP[i] * (1 - k) + CHAMP_BOT[i] * k) for i in range(3)))
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    d.text((W / 2, (455 if len(title) < 6 else 385) * s), line, font=font(SERIF_IT, 58), fill=CREAM, anchor="ma")
    shadowed(1810, "СМОТРЕТЬ ОБЗОР", font(SERIF, 28), CREAM, 12)
    img.convert("RGB").save(out, quality=96, subsampling=0, dpi=(300, 300))

if __name__ == "__main__":
    src, out_dir = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "design")
    scale = int(sys.argv[3]) if len(sys.argv) > 3 else 2
    for name, f, box, title, line, sat in COVERS:
        render(f"{src}/{f}", box, title, line, sat, scale, f"{out_dir}/{name}-cover.jpg")
        print("wrote", name)
