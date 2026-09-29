"""Beige "Ivory Atelier" Reels cover with all four Rituals sets: generous margins, thin type, hairlines (2160x3840 by default).

Usage: python3 design/make_rituals_combined.py <images dir with 5-8.jpg> [out.jpg] [scale]
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_IT = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
CREAM, CHAMP_TOP, CHAMP_BOT, BG = (58, 42, 34), (92, 68, 50), (58, 42, 34), (26, 20, 16)   # CREAM = ink brown text here
BRASS, MUTED = (176, 145, 96), (140, 118, 98)
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
    yy, xx = np.mgrid[0:H, 0:W]
    glow = np.clip(1 - np.hypot((xx - W / 2) / (W * 0.75), (yy - H * 0.52) / (H * 0.45)), 0, 1)[..., None] ** 1.6
    col = (np.array((236, 226, 211)) * (1 - t) + np.array((222, 206, 186)) * t) * (1 - glow) + np.array((249, 243, 233)) * glow
    col = col + np.random.default_rng(6).normal(0, 2, (H, W, 1))
    img = Image.fromarray(np.clip(np.broadcast_to(col, (H, W, 3)), 0, 255).astype("uint8")).convert("RGBA")
    for i, (f, box, _) in enumerate(SETS):
        x = (MARGIN + (i % 2) * (TW + GUT)) * s
        y = (GRID_Y0 + (i // 2) * (TH + BAND)) * s
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rectangle((x + 6 * s, y + 14 * s, x + TW * s + 6 * s, y + TH * s + 14 * s), fill=(90, 66, 46, 120))
        img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(20 * s)))
        img.paste(tile(f"{src}/{f}", box, TW * s, TH * s), (x, y))
        ImageDraw.Draw(img).rectangle((x, y, x + TW * s - 1, y + TH * s - 1), outline=BRASS + (200,), width=max(1, s))
    d = ImageDraw.Draw(img)
    def font(n, size): return ImageFont.truetype(n, size * s)
    def spaced(draw, cx, y, text, f, fill, track):
        widths = [draw.textlength(c, font=f) for c in text]
        x = cx - (sum(widths) + track * s * (len(text) - 1)) / 2
        for c, w in zip(text, widths):
            draw.text((x, y * s), c, font=f, fill=fill)
            x += w + track * s
    spaced(d, W / 2, 110, "FLANER COSMETICS", font(SERIF, 24), MUTED, 14)
    f = font(SERIF, 128)
    mask = Image.new("L", (W, H), 0)
    spaced(ImageDraw.Draw(mask), W / 2, 195, "RITUALS", f, 255, 40)
    bb = mask.getbbox()
    grad = Image.new("RGB", (W, H)); gd = ImageDraw.Draw(grad)
    for y in range(bb[1], bb[3] + 1):
        k = (y - bb[1]) / max(1, bb[3] - bb[1])
        gd.line((0, y, W, y), fill=tuple(int(CHAMP_TOP[j] * (1 - k) + CHAMP_BOT[j] * k) for j in range(3)))
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    def ornament(y):
        d.line((W / 2 - 110 * s, y * s, W / 2 - 16 * s, y * s), fill=BRASS, width=2 * s)
        d.line((W / 2 + 16 * s, y * s, W / 2 + 110 * s, y * s), fill=BRASS, width=2 * s)
        d.polygon([(W / 2, (y - 7) * s), (W / 2 + 7 * s, y * s), (W / 2, (y + 7) * s), (W / 2 - 7 * s, y * s)], fill=CHAMP_BOT)
    ornament(385)
    d.text((W / 2, 415 * s), "выбери свой ритуал", font=font(SERIF_IT, 48), fill=MUTED, anchor="ma")
    for i, (_, _, label) in enumerate(SETS):
        cx = (MARGIN + (i % 2) * (TW + GUT) + TW / 2) * s
        spaced(d, cx, GRID_Y0 + (i // 2) * (TH + BAND) + TH + 20, label, font(SERIF, 24), MUTED, 14)
    ornament(1775)
    spaced(d, W / 2, 1805, "СМОТРЕТЬ НАБОРЫ", font(SERIF, 26), CREAM, 14)
    img.convert("RGB").save(out, quality=96, subsampling=0, dpi=(300, 300))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "design/rituals-combined-beige.jpg",
         int(sys.argv[3]) if len(sys.argv) > 3 else 2)
