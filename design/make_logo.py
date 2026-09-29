"""flaner_cosmetics logo (Instagram profile photo): white, elegant, striking. Writes 2048x2048 PNGs.

Usage: python3 design/make_logo.py [out dir]
Two variants: wordmark and monogram seal. Content stays inside the circle Instagram crops the photo to.
"""
import math
import sys
from PIL import Image, ImageDraw, ImageFont

S, OUT = 4, 2048                     # supersample factor, output size
N = OUT * S
SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_IT = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
SERIF_B = "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf"
INK, ROSE_A, ROSE_B, WHITE = (28, 20, 18), (232, 190, 170), (176, 116, 100), (255, 255, 255)
C = N // 2

def font(path, size): return ImageFont.truetype(path, size * S)

def rose_gradient(size):
    """Diagonal rose-gold gradient used for the rings and ornaments."""
    g = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(g)
    for i in range(size * 2):
        k = i / (size * 2)
        k = 1 - abs(2 * k - 1)                          # light in the middle, deeper at the edges
        d.line((i, 0, 0, i), fill=tuple(int(ROSE_B[j] * (1 - k) + ROSE_A[j] * k) for j in range(3)), width=2)
    return g

def ring(img, r, width):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).ellipse((C - r * S, C - r * S, C + r * S, C + r * S), outline=255, width=width * S)
    img.paste(rose_gradient(N), (0, 0), mask)

def spaced(d, cx, y, text, f, fill, track):
    widths = [d.textlength(c, font=f) for c in text]
    x = cx - (sum(widths) + track * S * (len(text) - 1)) / 2
    for c, w in zip(text, widths):
        d.text((x, y * S), c, font=f, fill=fill)
        x += w + track * S

def diamond(img, cx, cy, r):
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).polygon([(cx, cy - r * S), (cx + r * S, cy), (cx, cy + r * S), (cx - r * S, cy)], fill=255)
    img.paste(rose_gradient(N), (0, 0), m)

def hairline(img, x0, x1, y, w=3):
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).line((x0 * S, y * S, x1 * S, y * S), fill=255, width=w * S)
    img.paste(rose_gradient(N), (0, 0), m)

def wordmark():
    img = Image.new("RGB", (N, N), WHITE)
    ring(img, 985, 5)
    ring(img, 950, 2)
    d = ImageDraw.Draw(img)
    diamond(img, C, 640 * S, 16)
    hairline(img, 640, 990, 640)
    hairline(img, 1058, 1408, 640)
    spaced(d, C, 720, "FLANER", font(SERIF, 330), INK, 34)
    hairline(img, 470, 1578, 1150, 4)
    spaced(d, C, 1210, "COSMETICS", font(SERIF, 86), INK, 78)
    diamond(img, C, 1420 * S, 16)
    hairline(img, 640, 990, 1420)
    hairline(img, 1058, 1408, 1420)
    return img

def arc_text(img, text, r, f, fill, track_deg):
    """Place the text along a circle, centred at the top."""
    d = ImageDraw.Draw(img)
    widths = [d.textlength(c, font=f) for c in text]
    angs = [w / (r * S) * 180 / math.pi for w in widths]
    a = -(sum(angs) + track_deg * (len(text) - 1)) / 2
    for c, w, dg in zip(text, widths, angs):
        ang = a + dg / 2
        size = int(f.size * 2)
        glyph = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ImageDraw.Draw(glyph).text((size // 2, size // 2), c, font=f, fill=fill + (255,), anchor="mm")
        rot = glyph.rotate(-ang, Image.BICUBIC, expand=True)
        rad = math.radians(ang)
        img.paste(rot, (int(C + r * S * math.sin(rad) - rot.width / 2), int(C - r * S * math.cos(rad) - rot.height / 2)), rot)
        a += dg + track_deg

def seal():
    img = Image.new("RGB", (N, N), WHITE)
    ring(img, 985, 5)
    ring(img, 950, 2)
    ring(img, 620, 3)
    d = ImageDraw.Draw(img)
    f = font(SERIF_IT, 760)
    d.text((C, C + 10 * S), "F", font=f, fill=INK, anchor="mm")
    arc_text(img, "FLANER  ·  COSMETICS", 785, font(SERIF, 104), INK, 6.5)
    diamond(img, C, (C // S + 785) * S, 14)
    return img

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "design"
    wordmark().resize((OUT, OUT), Image.LANCZOS).save(f"{out}/flaner-logo-wordmark.png", dpi=(300, 300))
    seal().resize((OUT, OUT), Image.LANCZOS).save(f"{out}/flaner-logo-seal.png", dpi=(300, 300))
