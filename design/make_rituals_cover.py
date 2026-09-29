"""Editorial 2x2 Reels cover (1080x1920) for four Rituals gift sets.

Usage: python3 design/make_rituals_cover.py <dir with 5.jpg..8.jpg> [out.png]
Each photo is cropped to the inside of its gift box (crop boxes tuned for the 960x1280 shop photos).
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_IT = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
BG_TOP, BG_BOT = (34, 24, 26), (58, 38, 40)
IVORY, BLUSH, BRASS = (245, 236, 222), (222, 190, 178), (190, 160, 118)
SETS = [  # file, crop box, label
    ("5.jpg", (114, 255, 812, 1036), "SAKURA"),
    ("6.jpg", (92, 236, 832, 1064), "AYURVEDA"),
    ("7.jpg", (110, 188, 815, 1024), "KARMA"),
    ("8.jpg", (116, 230, 878, 1080), "HOMME"),
]
TW, TH, GUT, MARGIN = 515, 590, 20, 15
GRID_Y = [465, 1100]

def tile(path, box):
    bgr = cv2.imread(path)
    x0, y0, x1, y1 = box
    crop = bgr[y0:y1, x0:x1]
    h, w = crop.shape[:2]
    if w / h > TW / TH:                                   # cover-fit to the tile ratio
        nw = int(h * TW / TH); x = (w - nw) // 2; crop = crop[:, x:x + nw]
    else:
        nh = int(w * TH / TW); y = (h - nh) // 2; crop = crop[y:y + nh, :]
    crop = cv2.resize(crop, (TW * 2, TH * 2), interpolation=cv2.INTER_AREA)
    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)
    lab[..., 0] = cv2.createCLAHE(1.4, (6, 6)).apply(lab[..., 0])
    crop = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    img = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)).resize((TW, TH), Image.LANCZOS)
    return img.filter(ImageFilter.UnsharpMask(1.2, 70, 2))

def spaced(d, cx, y, text, font, fill, track):
    widths = [d.textlength(c, font=font) for c in text]
    x = cx - (sum(widths) + track * (len(text) - 1)) / 2
    for c, w in zip(text, widths):
        d.text((x, y), c, font=font, fill=fill)
        x += w + track

def main(src_dir, out):
    t = np.linspace(0, 1, H)[:, None, None]
    col = np.array(BG_TOP) * (1 - t) + np.array(BG_BOT) * t
    col = col + np.random.default_rng(2).normal(0, 2.5, (H, W, 1))
    img = Image.fromarray(np.clip(np.broadcast_to(col, (H, W, 3)), 0, 255).astype("uint8"))
    d = ImageDraw.Draw(img)
    for i, (f, box, label) in enumerate(SETS):
        x = MARGIN + (i % 2) * (TW + GUT)
        y = GRID_Y[i // 2]
        m = Image.new("L", (TW, TH), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, TW - 1, TH - 1), 10, fill=255)
        img.paste(tile(f"{src_dir}/{f}", box), (x, y), m)
        spaced(d, x + TW / 2, y + TH + 16, label, ImageFont.truetype(SERIF, 30), IVORY, 10)
    spaced(d, W / 2, 96, "FLANER COSMETICS", ImageFont.truetype(SERIF, 28), BLUSH, 12)
    d.text((W / 2, 150), "RITUALS", font=ImageFont.truetype(SERIF, 200), fill=IVORY, anchor="ma")
    d.text((W / 2, 375), "выбери свой ритуал", font=ImageFont.truetype(SERIF_IT, 66), fill=BLUSH, anchor="ma")
    d.line((W / 2 - 50, 1790, W / 2 + 50, 1790), fill=BRASS, width=2)
    spaced(d, W / 2, 1822, "СМОТРЕТЬ НАБОРЫ", ImageFont.truetype(SERIF, 30), IVORY, 12)
    img.save(out, quality=95)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "design/rituals-cover.png")
