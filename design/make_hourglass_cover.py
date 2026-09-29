"""Soft "Blush Plaster" Reels cover (1080x1920) for the Hourglass Ambient palettes.

Usage: python3 design/make_hourglass_cover.py <carousel_screenshot> [out.png]
Crop boxes are tuned for the 787x1708 flaner_cosmetics carousel screenshot.
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_IT = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
BG = (229, 217, 204)
ESPRESSO, ROSE, TAUPE = (74, 54, 38), (168, 104, 100), (140, 118, 98)
BOXES = [(358, 335, 588, 540), (358, 575, 588, 780), (358, 815, 588, 1015)]
SLOTS = [(60, 500), (500, 860), (60, 1220)]       # top-left of each palette
PAL_W = 520

def upscale(im, w):
    bgr = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
    h = round(bgr.shape[0] * w / bgr.shape[1])
    mid = cv2.bilateralFilter(cv2.resize(bgr, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC), 5, 22, 5)
    big = cv2.resize(mid, (w, h), interpolation=cv2.INTER_LANCZOS4)
    out = Image.fromarray(cv2.cvtColor(big, cv2.COLOR_BGR2RGB))
    return out.filter(ImageFilter.UnsharpMask(2, 120, 2))

def background():
    rng = np.random.default_rng(3)
    y, x = np.mgrid[0:H, 0:W]
    light = 1.03 - 0.10 * np.hypot((x - 250) / W, (y - 100) / H)
    n = Image.fromarray((rng.normal(128, 40, (H // 4, W // 4))).clip(0, 255).astype("uint8"))
    n = np.asarray(n.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(3)), float) / 255 - 0.5
    img = np.array(BG, float)[None, None, :] * (light + n * 0.05 + rng.normal(0, 0.008, (H, W)))[..., None]
    return Image.fromarray(img.clip(0, 255).astype("uint8")).convert("RGBA")

def spaced(d, y, text, font, fill, track):
    widths = [d.textlength(c, font=font) for c in text]
    x = W / 2 - (sum(widths) + track * (len(text) - 1)) / 2
    for c, w in zip(text, widths):
        d.text((x, y), c, font=font, fill=fill)
        x += w + track

def main(src, out):
    shot = Image.open(src).convert("RGB")
    img = background()
    for box, (px, py) in zip(BOXES, SLOTS):
        tile = upscale(shot.crop(box), PAL_W).convert("RGBA")
        m = Image.new("L", tile.size, 0)
        ImageDraw.Draw(m).rounded_rectangle((34, 34, tile.width - 34, tile.height - 34), 40, fill=255)
        tile.putalpha(m.filter(ImageFilter.GaussianBlur(20)))
        img.alpha_composite(tile, (px, py))
    d = ImageDraw.Draw(img)
    spaced(d, 100, "FLANER COSMETICS", ImageFont.truetype(SERIF, 28), TAUPE, 12)
    d.text((W / 2, 190), "Hourglass", font=ImageFont.truetype(SERIF, 190), fill=ESPRESSO, anchor="ma")
    d.text((W / 2, 385), "выбери свою палетку", font=ImageFont.truetype(SERIF_IT, 62), fill=ROSE, anchor="ma")
    spaced(d, 1805, "СМОТРЕТЬ ОБЗОР", ImageFont.truetype(SERIF, 28), ESPRESSO, 12)
    img.convert("RGB").save(out, quality=95)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "design/hourglass-cover.png")
