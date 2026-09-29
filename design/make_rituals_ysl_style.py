"""Rituals Reels cover in the YSL cover style: full-bleed darkened photo, gradient, champagne title, four sets floating on top.

Usage: python3 design/make_rituals_combined.py <images dir with 5-8.jpg> [out.jpg] [scale]
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_IT = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
CREAM, CHAMP_TOP, CHAMP_BOT, BG = (245, 236, 218), (236, 224, 200), (205, 186, 154), (26, 20, 16)
SETS = [("5.jpg", (114, 255, 812, 1036), "SAKURA"), ("6.jpg", (92, 236, 832, 1064), "AYURVEDA"),
        ("7.jpg", (110, 188, 815, 1024), "KARMA"), ("8.jpg", (116, 230, 878, 1080), "HOMME")]
TW, TH = 440, 515                          # tile size in 1080x1920 units

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
    hsv[..., 1] *= 0.88; hsv[..., 2] *= 0.92
    out = cv2.cvtColor(np.clip(hsv, 0, 255).astype("uint8"), cv2.COLOR_HSV2BGR)
    img = Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))
    return img.filter(ImageFilter.UnsharpMask(3, 130, 2)).filter(ImageFilter.UnsharpMask(1, 60, 1))

def backdrop(path, W, H):
    bgr = cv2.imread(path)[0:1280, 60:900]
    big = cv2.resize(bgr, (W, H), interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), 38 * W / 1080)
    hsv = cv2.cvtColor(big, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] *= 0.9; hsv[..., 2] *= 0.42
    return Image.fromarray(cv2.cvtColor(np.clip(hsv, 0, 255).astype("uint8"), cv2.COLOR_HSV2BGR)[..., ::-1])

def place(base, im, cx, cy, angle, s):
    im = im.convert("RGBA")
    m = Image.new("L", im.size, 255)
    im.putalpha(m)
    rot = im.rotate(angle, Image.BICUBIC, expand=True)
    sh = Image.new("RGBA", rot.size, (0, 0, 0, 0))
    sh.putalpha(rot.getchannel("A").point(lambda v: int(v * 0.7)))
    pad = 90 * s
    layer = Image.new("RGBA", (rot.width + pad * 2, rot.height + pad * 2), (0, 0, 0, 0))
    layer.paste(sh, (pad + 10 * s, pad + 22 * s), sh)
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(24 * s)), (int(cx - layer.width / 2), int(cy - layer.height / 2)))
    base.alpha_composite(rot, (int(cx - rot.width / 2), int(cy - rot.height / 2)))

def main(src, out, s):
    W, H = 1080 * s, 1920 * s
    img = backdrop(f"{src}/6.jpg", W, H).convert("RGBA")
    spots = [(285, 830, -2), (795, 890, 2), (285, 1430, 2), (795, 1490, -2)]
    for (f, box, _), (cx, cy, ang) in zip(SETS, spots):
        place(img, tile(f"{src}/{f}", box, TW * s, TH * s), cx * s, cy * s, ang, s)
    r = np.arange(H)                                            # same gradient logic as the YSL cover
    top = np.clip(1 - r / (700 * s), 0, 1) ** 1.3 * 0.96
    bot = np.clip((r - (H - 380 * s)) / (380 * s), 0, 1) ** 1.3 * 0.92
    a = np.maximum(top, bot)[:, None] * np.ones((1, W), np.float32)
    layer = Image.new("RGBA", (W, H), BG + (0,))
    layer.putalpha(Image.fromarray((a * 255).astype("uint8")))
    img = Image.alpha_composite(img, layer)
    d = ImageDraw.Draw(img)
    def font(n, size): return ImageFont.truetype(n, size * s)
    def spaced(draw, cx, y, text, f, fill, track):
        widths = [draw.textlength(c, font=f) for c in text]
        x = cx - (sum(widths) + track * s * (len(text) - 1)) / 2
        for c, w in zip(text, widths):
            draw.text((x, y * s), c, font=f, fill=fill)
            x += w + track * s
    spaced(d, W / 2, 92, "FLANER COSMETICS", font(SERIF, 30), CREAM, 12)
    f = font(SERIF, 150)
    mask = Image.new("L", (W, H), 0)
    spaced(ImageDraw.Draw(mask), W / 2, 170, "RITUALS", f, 255, 34)
    bb = mask.getbbox()
    grad = Image.new("RGB", (W, H)); gd = ImageDraw.Draw(grad)
    for y in range(bb[1], bb[3] + 1):
        k = (y - bb[1]) / max(1, bb[3] - bb[1])
        gd.line((0, y, W, y), fill=tuple(int(CHAMP_TOP[j] * (1 - k) + CHAMP_BOT[j] * k) for j in range(3)))
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    d.text((W / 2, 385 * s), "выбери свой ритуал", font=font(SERIF_IT, 58), fill=CREAM, anchor="ma")
    spaced(d, W / 2, 1815, "СМОТРЕТЬ НАБОРЫ", font(SERIF, 28), CREAM, 12)
    img.convert("RGB").save(out, quality=96, subsampling=0, dpi=(300, 300))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "design/rituals-ysl-style-cover.jpg",
         int(sys.argv[3]) if len(sys.argv) > 3 else 2)
