"""Compose a 1080x1920 luxury Reels cover for YSL from a product photo.

Usage: python3 design/make_ysl_cover.py <photo> [out.png]
Photo crop box below is tuned for the flaner_cosmetics YSL table screenshot.
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

W, H = 1080, 1920
BROWN, GOLD = (74, 54, 38), (176, 141, 87)
SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_IT = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"

def plaster():
    rng = np.random.default_rng(7)
    y, x = np.mgrid[0:H, 0:W]
    light = 1 - 0.10 * np.hypot((x - 200) / W, (y - 150) / H)   # window glow, upper left
    base = np.array([236, 224, 204], float)
    noise = Image.fromarray((rng.normal(0, 1, (H // 4, W // 4)) * 40 + 128).clip(0, 255).astype("uint8"))
    noise = np.asarray(noise.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(3)), float) / 255 - 0.5
    fine = rng.normal(0, 1, (H, W)) * 0.012
    img = base[None, None, :] * (light + noise * 0.06 + fine)[..., None]
    return Image.fromarray(img.clip(0, 255).astype("uint8"))

def spaced(d, xy, text, font, fill, track=0, anchor="c"):
    widths = [d.textlength(c, font=font) for c in text]
    total = sum(widths) + track * (len(text) - 1)
    x, y = xy
    x = x - total / 2 if anchor == "c" else x
    for c, w in zip(text, widths):
        d.text((x, y), c, font=font, fill=fill)
        x += w + track

def enhance(src_path, box, size):
    """Clean the UI overlay, upscale in two steps, then recover local contrast and detail."""
    bgr = cv2.imread(src_path)
    if bgr is None:  # cv2 cannot read webp on some builds
        bgr = cv2.cvtColor(np.asarray(Image.open(src_path).convert("RGB")), cv2.COLOR_RGB2BGR)
    mask = np.zeros(bgr.shape[:2], np.uint8)
    mask[832:870, 428:468] = 255                     # sound button in the screenshot
    bgr = cv2.inpaint(bgr, mask, 5, cv2.INPAINT_TELEA)
    x0, y0, x1, y1 = box
    crop = bgr[y0:y1, x0:x1]
    w, h = size
    mid = cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    mid = cv2.bilateralFilter(mid, 5, 25, 5)          # smooth compression blocks
    big = cv2.resize(mid, (w, h), interpolation=cv2.INTER_LANCZOS4)
    lab = cv2.cvtColor(big, cv2.COLOR_BGR2LAB)
    lab[..., 0] = cv2.createCLAHE(1.6, (6, 6)).apply(lab[..., 0])
    big = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    img = Image.fromarray(cv2.cvtColor(big, cv2.COLOR_BGR2RGB))
    img = img.filter(ImageFilter.UnsharpMask(3, 140, 2)).filter(ImageFilter.UnsharpMask(1, 60, 1))
    return img

def main(src, out):
    bg = plaster().convert("RGBA")
    aw, ah = 760, 1120
    photo = enhance(src, (100, 330, 474, 879), (aw, ah))
    photo = ImageEnhance.Color(photo).enhance(0.92)
    photo = ImageEnhance.Contrast(photo).enhance(1.05)
    ax, ay = (W - aw) // 2, 530

    mask = Image.new("L", (aw, ah), 0)                      # arch window
    m = ImageDraw.Draw(mask)
    m.rounded_rectangle((0, 0, aw, ah), 14, fill=255)
    m.rectangle((0, 0, aw, aw // 2), fill=0)
    m.pieslice((0, 0, aw, aw), 180, 360, fill=255)
    m.rectangle((0, aw // 2, aw, ah), fill=255)
    m.rectangle((0, ah - 14, aw, ah), fill=255)

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shadow.paste((90, 65, 40, 110), (ax + 18, ay + 26), mask)
    bg = Image.alpha_composite(bg, shadow.filter(ImageFilter.GaussianBlur(28)))
    bg.paste(photo, (ax, ay), mask)

    warm = Image.new("RGBA", (aw, ah), (255, 236, 200, 0))   # window sheen over the photo
    g = np.linspace(70, 0, aw)[None, :].repeat(ah, 0).astype("uint8")
    warm.putalpha(Image.fromarray(g))
    bg.paste(warm, (ax, ay), Image.composite(warm.getchannel("A"), Image.new("L", (aw, ah), 0), mask))

    d = ImageDraw.Draw(bg)
    pad = 26                                                 # thin gold frame around the arch
    fx0, fy0, fx1, fy1 = ax - pad, ay - pad, ax + aw + pad, ay + ah + pad
    d.arc((fx0, fy0, fx1, fy0 + aw + 2 * pad), 180, 360, fill=GOLD, width=2)
    d.line((fx0, fy0 + aw // 2 + pad, fx0, fy1), fill=GOLD, width=2)
    d.line((fx1, fy0 + aw // 2 + pad, fx1, fy1), fill=GOLD, width=2)
    d.line((fx0, fy1, fx1, fy1), fill=GOLD, width=2)

    spaced(d, (W / 2, 215), "YVES SAINT LAURENT", ImageFont.truetype(SERIF, 30), GOLD, track=9)
    head = ImageFont.truetype(SERIF, 118)
    d.text((W / 2, 285), "Роскошь", font=head, fill=BROWN, anchor="ma")
    sub = ImageFont.truetype(SERIF_IT, 66)
    d.text((W / 2, 410), "в деталях", font=sub, fill=GOLD, anchor="ma")

    cx, cy, r = 118, 118, 52                                 # flaner logo, top-left
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(250, 244, 232), outline=GOLD, width=2)
    spaced(d, (cx, cy - 10), "FLANER", ImageFont.truetype(SERIF, 19), BROWN, track=1)

    d.line((W / 2 - 40, 1730, W / 2 + 40, 1730), fill=GOLD, width=2)
    spaced(d, (W / 2, 1760), "СМОТРЕТЬ ОБЗОР", ImageFont.truetype(SERIF, 32), BROWN, track=8)
    spaced(d, (W / 2, 1820), "@flaner_cosmetics", ImageFont.truetype(SERIF_IT, 28), GOLD, track=2)

    bg.convert("RGB").save(out, quality=95)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "design/ysl-cover.png")
