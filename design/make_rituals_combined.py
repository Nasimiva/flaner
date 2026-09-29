"""One full-bleed dark Reels cover with all four Rituals sets in a seamless 2x2 grid (2160x3840 by default).

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
GRID_Y0, TW, TH, BAND = 440, 540, 590, 62   # 1080x1920 units; a dark label band sits under each row

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

def main(src, out, s):
    W, H = 1080 * s, 1920 * s
    img = Image.new("RGBA", (W, H), BG + (255,))
    for i, (f, box, _) in enumerate(SETS):
        img.paste(tile(f"{src}/{f}", box, TW * s, TH * s), ((i % 2) * TW * s, (GRID_Y0 + (i // 2) * (TH + BAND)) * s))
    a = np.zeros(H, np.float32)                                # fades into the dark top and bottom
    y0, y1 = GRID_Y0 * s, (GRID_Y0 + 2 * TH + BAND) * s
    r = np.arange(H)
    a = np.maximum(np.clip(1 - (r - y0) / (100 * s), 0, 1), np.clip((r - (y1 - 100 * s)) / (100 * s), 0, 1)) ** 1.2
    a[:y0] = 1; a[y1:] = 1
    xx = np.arange(W)[None, :]
    vig = np.clip(np.abs(xx - W / 2) / (W / 2) - 0.7, 0, 1) * 0.5
    layer = Image.new("RGBA", (W, H), BG + (0,))
    layer.putalpha(Image.fromarray((np.clip(a[:, None] + vig, 0, 1) * 255).astype("uint8")))
    img = Image.alpha_composite(img, layer)
    d = ImageDraw.Draw(img)
    for i in range(1, 2):                                      # hairline seams between the photos
        d.line((TW * s, y0, TW * s, y1), fill=BG, width=3 * s)
    def font(n, size): return ImageFont.truetype(n, size * s)
    def spaced(draw, cx, y, text, f, fill, track, anchor="c"):
        widths = [draw.textlength(c, font=f) for c in text]
        x = cx - (sum(widths) + track * s * (len(text) - 1)) / 2 if anchor == "c" else cx
        for c, w in zip(text, widths):
            draw.text((x, y * s), c, font=f, fill=fill)
            x += w + track * s
    spaced(d, W / 2, 80, "FLANER COSMETICS", font(SERIF, 30), CREAM, 12)
    f = font(SERIF, 170)
    mask = Image.new("L", (W, H), 0)
    spaced(ImageDraw.Draw(mask), W / 2, 150, "RITUALS", f, 255, 26)
    bb = mask.getbbox()
    grad = Image.new("RGB", (W, H)); gd = ImageDraw.Draw(grad)
    for y in range(bb[1], bb[3] + 1):
        k = (y - bb[1]) / max(1, bb[3] - bb[1])
        gd.line((0, y, W, y), fill=tuple(int(CHAMP_TOP[j] * (1 - k) + CHAMP_BOT[j] * k) for j in range(3)))
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    d.text((W / 2, 348 * s), "выбери свой ритуал", font=font(SERIF_IT, 58), fill=CREAM, anchor="ma")
    for i, (_, _, label) in enumerate(SETS):                    # set names in the corner of each photo
        cx = (i % 2) * TW * s + TW * s / 2
        y = GRID_Y0 + (i // 2) * (TH + BAND) + TH + 14
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        spaced(ImageDraw.Draw(sh), cx, y + 2, label, font(SERIF, 28), (0, 0, 0, 220), 12)
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5 * s)))
        spaced(ImageDraw.Draw(img), cx, y, label, font(SERIF, 28), CREAM, 12)
    d = ImageDraw.Draw(img)
    spaced(d, W / 2, 1800, "СМОТРЕТЬ НАБОРЫ", font(SERIF, 28), CREAM, 12)
    img.convert("RGB").save(out, quality=96, subsampling=0, dpi=(300, 300))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "design/rituals-combined-cover.jpg",
         int(sys.argv[3]) if len(sys.argv) > 3 else 2)
