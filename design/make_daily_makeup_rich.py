"""Deep-wine "daily makeup" Reels cover with luxury decorative cosmetics instead of the presenter (2160x3840).

Usage: python3 design/make_daily_makeup_rich.py <images dir with 4.webp (YSL) and 9.jpg (NARS)> [out.jpg] [scale]
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_IT = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
CHAMP_TOP, CHAMP_BOT, CREAM, MUTED, BRASS = (238, 222, 190), (204, 176, 132), (245, 236, 218), (214, 194, 176), (170, 138, 92)
TW, TH, TX, TY = 900, 500, 90, [590, 1124]          # tile size and positions in 1080x1920 units
FRAMES = [("9.jpg", (0, 410, 522, 700)), ("4.webp", (135, 640, 589, 892))]   # NARS blushes, YSL palette and clutch

def tile(path, box, w, h):
    bgr = cv2.imread(path)
    if bgr is None:
        bgr = cv2.cvtColor(np.asarray(Image.open(path).convert("RGB")), cv2.COLOR_RGB2BGR)
    crop = bgr[box[1]:box[3], box[0]:box[2]]
    big = cv2.resize(cv2.bilateralFilter(cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC), 5, 22, 5),
                     (w, h), interpolation=cv2.INTER_LANCZOS4)
    lab = cv2.cvtColor(big, cv2.COLOR_BGR2LAB)
    lab[..., 0] = cv2.createCLAHE(1.2, (6, 6)).apply(lab[..., 0])
    hsv = cv2.cvtColor(cv2.cvtColor(lab, cv2.COLOR_LAB2BGR), cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] *= 0.9; hsv[..., 2] *= 0.94
    out = cv2.cvtColor(np.clip(hsv, 0, 255).astype("uint8"), cv2.COLOR_HSV2BGR)
    img = Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))
    return img.filter(ImageFilter.UnsharpMask(3, 120, 2)).filter(ImageFilter.UnsharpMask(1, 55, 1))

def main(src, out, s):
    W, H = 1080 * s, 1920 * s
    t = np.linspace(0, 1, H)[:, None, None]
    yy, xx = np.mgrid[0:H, 0:W]
    glow = np.clip(1 - np.hypot((xx - W / 2) / (W * 0.75), (yy - H * 0.5) / (H * 0.45)), 0, 1)[..., None] ** 1.6
    col = (np.array((30, 14, 20)) * (1 - t) + np.array((52, 24, 34)) * t) * (1 - glow) + np.array((112, 54, 68)) * glow
    col = col + np.random.default_rng(9).normal(0, 2, (H, W, 1))
    img = Image.fromarray(np.clip(col, 0, 255).astype("uint8")).convert("RGBA")
    for (f, box), ty in zip(FRAMES, TY):
        x, y, w, h = TX * s, ty * s, TW * s, TH * s
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rectangle((x + 6 * s, y + 14 * s, x + w + 6 * s, y + h + 14 * s), fill=(0, 0, 0, 200))
        img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(18 * s)))
        img.paste(tile(f"{src}/{f}", box, w, h), (x, y))
        ImageDraw.Draw(img).rectangle((x, y, x + w - 1, y + h - 1), outline=BRASS + (255,), width=max(1, s))
    d = ImageDraw.Draw(img)
    def font(n, size): return ImageFont.truetype(n, size * s)
    def spaced(draw, cx, y, text, f, fill, track):
        widths = [draw.textlength(c, font=f) for c in text]
        x = cx - (sum(widths) + track * s * (len(text) - 1)) / 2
        for c, w in zip(text, widths):
            draw.text((x, y * s), c, font=f, fill=fill)
            x += w + track * s
    def champagne(y, text, size, track):
        mask = Image.new("L", (W, H), 0)
        spaced(ImageDraw.Draw(mask), W / 2, y, text, font(SERIF, size), 255, track)
        bb = mask.getbbox()
        grad = Image.new("RGB", (W, H)); gd = ImageDraw.Draw(grad)
        for yy_ in range(bb[1], bb[3] + 1):
            k = (yy_ - bb[1]) / max(1, bb[3] - bb[1])
            gd.line((0, yy_, W, yy_), fill=tuple(int(CHAMP_TOP[j] * (1 - k) + CHAMP_BOT[j] * k) for j in range(3)))
        img.paste(grad, (0, 0), mask)
    def ornament(y):
        dd = ImageDraw.Draw(img)
        dd.line((W / 2 - 110 * s, y * s, W / 2 - 16 * s, y * s), fill=BRASS, width=2 * s)
        dd.line((W / 2 + 16 * s, y * s, W / 2 + 110 * s, y * s), fill=BRASS, width=2 * s)
        dd.polygon([(W / 2, (y - 7) * s), (W / 2 + 7 * s, y * s), (W / 2, (y + 7) * s), (W / 2 - 7 * s, y * s)], fill=CHAMP_BOT)
    spaced(d, W / 2, 96, "FLANER COSMETICS", font(SERIF, 24), MUTED, 14)
    d.text((W / 2, 150 * s), "daily", font=font(SERIF_IT, 96), fill=CHAMP_BOT, anchor="ma")
    champagne(268, "MAKEUP", 124, 40)
    ornament(452)
    ImageDraw.Draw(img).text((W / 2, 478 * s), "макияж, который выглядит дорого", font=font(SERIF_IT, 46), fill=MUTED, anchor="ma")
    ornament(1710)
    spaced(ImageDraw.Draw(img), W / 2, 1745, "СМОТРЕТЬ РИЛС", font(SERIF, 26), CREAM, 14)
    img.convert("RGB").save(out, quality=96, subsampling=0, dpi=(300, 300))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "design/daily-makeup-rich-cover.jpg",
         int(sys.argv[3]) if len(sys.argv) > 3 else 2)
