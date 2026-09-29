"""Full-bleed cinematic "Noir Gold" Reels cover (1080x1920), no frames.

Usage: python3 design/make_ysl_cover_noir.py <photo> [out.png]
Crop box is tuned for the 589x1280 flaner_cosmetics YSL table screenshot.
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_IT = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
GOLD_TOP, GOLD_BOT = (236, 224, 200), (205, 186, 154)   # muted champagne, not shiny gold
CREAM = (245, 236, 218)

def photo_layer(path, box):
    bgr = cv2.imread(path)
    if bgr is None:
        bgr = cv2.cvtColor(np.asarray(Image.open(path).convert("RGB")), cv2.COLOR_RGB2BGR)
    mask = np.zeros(bgr.shape[:2], np.uint8)
    mask[1090:1140, 528:578] = 255                       # sound button
    bgr = cv2.inpaint(bgr, mask, 5, cv2.INPAINT_TELEA)
    x0, y0, x1, y1 = box
    crop = bgr[y0:y1, x0:x1]
    mid = cv2.bilateralFilter(cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC), 5, 25, 5)
    big = cv2.resize(mid, (W, H), interpolation=cv2.INTER_LANCZOS4)
    lab = cv2.cvtColor(big, cv2.COLOR_BGR2LAB)
    lab[..., 0] = cv2.createCLAHE(1.2, (6, 6)).apply(lab[..., 0])
    big = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR).astype(np.float32)
    hsv = cv2.cvtColor(big.astype("uint8"), cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] *= 0.62                                   # tone down the loud gold
    hsv[..., 2] *= 0.88
    big = cv2.cvtColor(np.clip(hsv, 0, 255).astype("uint8"), cv2.COLOR_HSV2BGR).astype(np.float32)
    big[..., 0] *= 0.96                                   # gentle warm grade
    big[..., 2] *= 1.02
    big = np.clip((big - 128) * 1.04 + 112, 0, 255)
    img = Image.fromarray(cv2.cvtColor(big.astype("uint8"), cv2.COLOR_BGR2RGB))
    return img.filter(ImageFilter.UnsharpMask(3, 150, 2)).filter(ImageFilter.UnsharpMask(1, 60, 1))

def gradient(top_a, bot_a, top_h, bot_h, color=(22, 14, 8)):
    a = np.zeros((H, W), np.float32)
    t = np.clip(1 - np.arange(H) / top_h, 0, 1) ** 1.4 * top_a
    b = np.clip((np.arange(H) - (H - bot_h)) / bot_h, 0, 1) ** 1.3 * bot_a
    a[:] = np.maximum(t, b)[:, None]
    yy, xx = np.mgrid[0:H, 0:W]
    vig = np.clip(np.hypot((xx - W / 2) / W, (yy - H / 2) / H) - 0.35, 0, 1) * 0.9
    a = np.clip(a + vig * 0.5, 0, 1)
    layer = Image.new("RGBA", (W, H), color + (0,))
    layer.putalpha(Image.fromarray((a * 255).astype("uint8")))
    return layer

def gold_text(size_img, xy, text, font, anchor="ma", track=0):
    mask = Image.new("L", size_img.size, 0)
    d = ImageDraw.Draw(mask)
    if track:
        widths = [d.textlength(c, font=font) for c in text]
        x = xy[0] - (sum(widths) + track * (len(text) - 1)) / 2
        for c, w in zip(text, widths):
            d.text((x, xy[1]), c, font=font, fill=255)
            x += w + track
    else:
        d.text(xy, text, font=font, fill=255, anchor=anchor)
    bbox = mask.getbbox()
    grad = Image.new("RGB", size_img.size)
    gd = ImageDraw.Draw(grad)
    y0, y1 = bbox[1], bbox[3]
    for y in range(y0, y1 + 1):
        k = (y - y0) / max(1, y1 - y0)
        gd.line((0, y, W, y), fill=tuple(int(GOLD_TOP[i] * (1 - k) + GOLD_BOT[i] * k) for i in range(3)))
    size_img.paste(grad, (0, 0), mask)

def main(src, out):
    img = photo_layer(src, (133, 338, 589, 1150)).convert("RGBA")
    img = Image.alpha_composite(img, gradient(0.97, 0.90, 900, 620, (26, 20, 16)))
    d = ImageDraw.Draw(img)

    def spaced(y, text, font, fill, track):
        shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        widths = [sd.textlength(c, font=font) for c in text]
        x = W / 2 - (sum(widths) + track * (len(text) - 1)) / 2
        for c, w in zip(text, widths):
            sd.text((x, y + 2), c, font=font, fill=(0, 0, 0, 200))
            x += w + track
        img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(5)))
        widths = [d.textlength(c, font=font) for c in text]
        x = W / 2 - (sum(widths) + track * (len(text) - 1)) / 2
        for c, w in zip(text, widths):
            d.text((x, y), c, font=font, fill=fill)
            x += w + track

    spaced(92, "FLANER COSMETICS", ImageFont.truetype(SERIF, 30), CREAM, 12)
    gold_text(img, (W // 2, 190), "YSL", ImageFont.truetype(SERIF, 230), track=40)
    d.text((W / 2, 455), "Роскошь в деталях", font=ImageFont.truetype(SERIF_IT, 58), fill=CREAM, anchor="ma")
    spaced(1810, "СМОТРЕТЬ ОБЗОР", ImageFont.truetype(SERIF, 28), CREAM, 12)
    img.convert("RGB").save(out, quality=95)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "design/ysl-cover-noir.png")
