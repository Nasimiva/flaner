"""Bold, fashion-editorial Reels cover (1080x1920) for the Hourglass Ambient palettes.

Usage: python3 design/make_hourglass_bold.py <carousel_screenshot> [out.png]
Palettes are cut out of the screenshot (GrabCut plus a clean rounded body) and set
on a deep berry-rose gradient with oversized type. Boxes are tuned for the 787x1708 screenshot.
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_IT = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
BOXES = [(358, 335, 588, 540), (358, 575, 588, 780), (358, 815, 588, 1015)]
CREAM, BLUSH = (247, 236, 222), (240, 200, 190)
SCALE = 3

def cutout(shot, box):
    x0, y0, x1, y1 = box
    crop = cv2.cvtColor(np.asarray(shot.crop(box)), cv2.COLOR_RGB2BGR)
    big = cv2.resize(crop, None, fx=SCALE, fy=SCALE, interpolation=cv2.INTER_CUBIC)
    big = cv2.bilateralFilter(big, 5, 22, 5)
    h, w = big.shape[:2]
    m = np.zeros((h, w), np.uint8)
    cv2.grabCut(big, m, (int(w * .03), int(h * .02), int(w * .94), int(h * .93)),
                np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_RECT)
    a = np.where((m == 1) | (m == 3), 255, 0).astype(np.uint8)
    a = cv2.morphologyEx(a, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    ys, xs = np.nonzero(a)
    widths = (a > 0).sum(axis=1)
    by0 = int(np.argmax(widths > 0.6 * widths.max()))   # first row of the lid, below the clasp
    body = np.nonzero(a[by0:])
    bx0, bx1, by1 = body[1].min(), body[1].max(), body[0].max() + by0
    clean = np.zeros((h, w), np.uint8)
    cv2.rectangle(clean, (bx0 + 6, by0 + 4), (bx1 - 6, by1 - 6), 255, -1)
    clean = cv2.GaussianBlur(clean, (0, 0), 22)
    clean = np.where(clean > 128, 255, 0).astype(np.uint8)
    top = np.zeros_like(a)                             # keep the real clasp shape only
    top[:by0 + 10, int(w * .30):int(w * .70)] = a[:by0 + 10, int(w * .30):int(w * .70)]
    alpha = cv2.GaussianBlur(np.maximum(clean, top), (0, 0), 1.6)
    rgb = cv2.cvtColor(big, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(rgb).convert("RGBA")
    img.putalpha(Image.fromarray(alpha))
    return img.crop(img.getbbox())

def background():
    y = np.linspace(0, 1, H)[:, None, None]
    top, mid, bot = np.array([92, 40, 52.]), np.array([150, 78, 82.]), np.array([196, 128, 120.])
    k = np.where(y < .55, y / .55, (y - .55) / .45)
    col = np.where(y < .55, top + (mid - top) * k, mid + (bot - mid) * k)
    xx = np.linspace(-1, 1, W)[None, :, None]
    col = col * (1.08 - 0.16 * xx ** 2) + np.random.default_rng(5).normal(0, 3, (H, W, 1))
    return Image.fromarray(np.clip(np.broadcast_to(col, (H, W, 3)), 0, 255).astype("uint8")).convert("RGBA")

def place(base, tile, cx, cy, width, angle):
    t = tile.resize((width, round(tile.height * width / tile.width)), Image.LANCZOS)
    t = t.filter(ImageFilter.UnsharpMask(2, 110, 2)).rotate(angle, Image.BICUBIC, expand=True)
    sh = Image.new("RGBA", t.size, (30, 8, 14, 0))
    sh.putalpha(t.getchannel("A").point(lambda v: int(v * .55)))
    pad = 120
    layer = Image.new("RGBA", (t.width + pad * 2, t.height + pad * 2), (0, 0, 0, 0))
    layer.paste(sh, (pad + 26, pad + 44), sh)
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(30)), (cx - layer.width // 2, cy - layer.height // 2))
    base.alpha_composite(t, (cx - t.width // 2, cy - t.height // 2))

def spaced(d, y, text, font, fill, track):
    widths = [d.textlength(c, font=font) for c in text]
    x = W / 2 - (sum(widths) + track * (len(text) - 1)) / 2
    for c, w in zip(text, widths):
        d.text((x, y), c, font=font, fill=fill)
        x += w + track

def main(src, out):
    shot = Image.open(src).convert("RGB")
    img = background()
    tiles = [cutout(shot, b) for b in BOXES]
    place(img, tiles[2], 430, 1420, 640, 4)
    place(img, tiles[1], 650, 1090, 640, -4)
    place(img, tiles[0], 430, 750, 660, 3)
    d = ImageDraw.Draw(img)
    spaced(d, 92, "FLANER COSMETICS", ImageFont.truetype(SERIF, 28), BLUSH, 12)
    spaced(d, 170, "HOURGLASS", ImageFont.truetype(SERIF, 148), CREAM, 4)
    d.text((W / 2, 350), "выбери свою палетку", font=ImageFont.truetype(SERIF_IT, 70), fill=BLUSH, anchor="ma")
    d.line((W / 2 - 50, 1748, W / 2 + 50, 1748), fill=BLUSH, width=2)
    spaced(d, 1785, "СМОТРЕТЬ ОБЗОР", ImageFont.truetype(SERIF, 30), CREAM, 12)
    img.convert("RGB").save(out, quality=95)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "design/hourglass-cover-bold.png")
