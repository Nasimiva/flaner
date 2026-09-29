"""Elegant dark Reels cover with all four Rituals sets: generous margins, thin type, hairlines (2160x3840 by default).

Usage: python3 design/make_rituals_combined.py <images dir with 5-8.jpg> [out.jpg] [scale]
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_IT = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
CREAM, CHAMP_TOP, CHAMP_BOT, BG = (245, 236, 218), (236, 224, 200), (205, 186, 154), (26, 20, 16)
BRASS, MUTED = (176, 145, 96), (200, 184, 164)
SETS = [("5.jpg", (114, 255, 812, 1036), "SAKURA"), ("6.jpg", (92, 236, 832, 1064), "AYURVEDA"),
        ("7.jpg", (110, 188, 815, 1024), "KARMA"), ("8.jpg", (116, 230, 878, 1080), "HOMME")]
MARGIN, GUT, TW, TH, GRID_Y0, BAND = 72, 20, 458, 520, 560, 62   # 1080x1920 units

def tile(path, box, w, h):
    bgr = cv2.imread(path)[box[1]:box[3], box[0]:box[2]]
    ch, cw = bgr.shape[:2]
    if cw / ch > w / h:
        nw = int(ch * w / h); x = (cw - nw) // 2; bgr = bgr[:, x:x + nw]
    else:
        nh = int(cw * h / w); y = (ch - nh) // 2; bgr = bgr[y:y + nh, :]
    big = cv2.resize(cv2.bilateralFilter(cv2.resize(bgr, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC), 5, 22, 5),
                     (w, h), interpolation=cv2.INTER_LANCZOS4)
    lab = cv2.cvtColor(big, cv2.COLOR_BGR2LAB)
    lab[..., 0] = cv2.createCLAHE(1.2, (6, 6)).apply(lab[..., 0])
    hsv = cv2.cvtColor(cv2.cvtColor(lab, cv2.COLOR_LAB2BGR), cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] *= 0.78; hsv[..., 2] *= 0.92
    out = cv2.cvtColor(np.clip(hsv, 0, 255).astype("uint8"), cv2.COLOR_HSV2BGR)
    img = Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))
    return img.filter(ImageFilter.UnsharpMask(3, 130, 2)).filter(ImageFilter.UnsharpMask(1, 60, 1))

def main(src, out, s):
    W, H = 1080 * s, 1920 * s
    t = np.linspace(0, 1, H)[:, None, None]
    col = np.array((28, 21, 19)) * (1 - t) + np.array((46, 32, 31)) * t + np.random.default_rng(6).normal(0, 2, (H, W, 1))
    img = Image.fromarray(np.clip(np.broadcast_to(col, (H, W, 3)), 0, 255).astype("uint8")).convert("RGBA")
    for i, (f, box, _) in enumerate(SETS):
        x = (MARGIN + (i % 2) * (TW + GUT)) * s
        y = (GRID_Y0 + (i // 2) * (TH + BAND)) * s
        img.paste(tile(f"{src}/{f}", box, TW * s, TH * s), (x, y))
    d = ImageDraw.Draw(img)
    def font(n, size): return ImageFont.truetype(n, size * s)
    def spaced(draw, cx, y, text, f, fill, track):
        widths = [draw.textlength(c, font=f) for c in text]
        x = cx - (sum(widths) + track * s * (len(text) - 1)) / 2
        for c, w in zip(text, widths):
            draw.text((x, y * s), c, font=f, fill=fill)
            x += w + track * s
    spaced(d, W / 2, 110, "FLANER COSMETICS", font(SERIF, 24), MUTED, 14)
    f = font(SERIF, 118)
    mask = Image.new("L", (W, H), 0)
    spaced(ImageDraw.Draw(mask), W / 2, 200, "RITUALS", f, 255, 44)
    bb = mask.getbbox()
    grad = Image.new("RGB", (W, H)); gd = ImageDraw.Draw(grad)
    for y in range(bb[1], bb[3] + 1):
        k = (y - bb[1]) / max(1, bb[3] - bb[1])
        gd.line((0, y, W, y), fill=tuple(int(CHAMP_TOP[j] * (1 - k) + CHAMP_BOT[j] * k) for j in range(3)))
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    d.line((W / 2 - 60 * s, 385 * s, W / 2 + 60 * s, 385 * s), fill=BRASS, width=2 * s)
    d.text((W / 2, 415 * s), "выбери свой ритуал", font=font(SERIF_IT, 48), fill=MUTED, anchor="ma")
    for i, (_, _, label) in enumerate(SETS):
        cx = (MARGIN + (i % 2) * (TW + GUT) + TW / 2) * s
        spaced(d, cx, GRID_Y0 + (i // 2) * (TH + BAND) + TH + 20, label, font(SERIF, 24), MUTED, 14)
    d.line((W / 2 - 60 * s, 1775 * s, W / 2 + 60 * s, 1775 * s), fill=BRASS, width=2 * s)
    spaced(d, W / 2, 1805, "СМОТРЕТЬ НАБОРЫ", font(SERIF, 26), CREAM, 14)
    img.convert("RGB").save(out, quality=96, subsampling=0, dpi=(300, 300))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "design/rituals-combined-elegant.jpg",
         int(sys.argv[3]) if len(sys.argv) > 3 else 2)
