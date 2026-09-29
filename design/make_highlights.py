"""Instagram Highlights covers (1080x1920) for flaner_cosmetics: line icons plus a tracked serif label.

Usage: python3 design/make_highlights.py [out dir]
Writes 8 covers in two colourways (ivory = light, wine = dark) and a contact sheet for each.
Content sits inside the central circle that Instagram crops covers to.
"""
import math
import os
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, S = 1080, 1920, 3
SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_IT = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
CX, CY = 540, 900
THEMES = {
    "ivory": dict(bg=((243, 235, 222), (228, 213, 193), (251, 246, 238)), line=((150, 98, 84), (214, 168, 150)), text=(58, 42, 34), sub=(140, 118, 98)),
    "wine": dict(bg=((26, 12, 17), (48, 22, 32), (108, 52, 66)), line=((186, 152, 108), (240, 222, 190)), text=(245, 236, 218), sub=(214, 194, 176)),
}
ITEMS = ["НОВИНКИ", "НАБОРЫ", "МАКИЯЖ", "УХОД", "ПАРФЮМ", "ОТЗЫВЫ", "ДОСТАВКА", "ЗАКАЗ"]
ORNAMENT_Y = 1210

def background(colors):
    top, bot, glow_c = (np.array(c, float) for c in colors)
    t = np.linspace(0, 1, H)[:, None, None]
    yy, xx = np.mgrid[0:H, 0:W]
    glow = np.clip(1 - np.hypot((xx - W / 2) / (W * 0.7), (yy - 960) / (H * 0.35)), 0, 1)[..., None] ** 1.5
    col = (top * (1 - t) + bot * t) * (1 - glow) + glow_c * glow + np.random.default_rng(12).normal(0, 1.8, (H, W, 1))
    return Image.fromarray(np.clip(col, 0, 255).astype("uint8")).convert("RGB")

def line_gradient(c0, c1):
    n = LOC * S
    k = np.linspace(0, 1, n)[None, :, None]
    g = np.array(c0, float) * (1 - k) + np.array(c1, float) * k
    return Image.fromarray(np.repeat(g, n, axis=0).astype("uint8"))

# ---- icons: each returns (filled shapes to outline, extra strokes); coordinates relative to the icon centre
LOC = 1100                                          # local icon canvas (1x units), centred on the icon
def P(x, y): return ((LOC / 2 + x) * S, (LOC / 2 + y) * S)

def star_pts(cx, cy, R, r, n, rot=-90):
    out = []
    for i in range(n * 2):
        a = math.radians(rot + i * 180 / n)
        rr = R if i % 2 == 0 else r
        out.append(P(cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return out

def draw_icon(name, fill, stroke):
    """fill(d): shapes to be outlined; stroke(d): open lines drawn as they are."""
    if name == "НОВИНКИ":
        fill.append(("poly", star_pts(0, 0, 175, 34, 4, -90)))
        fill.append(("poly", star_pts(150, -120, 62, 14, 4, -90)))
        fill.append(("poly", star_pts(-150, 120, 46, 11, 4, -90)))
    elif name == "НАБОРЫ":
        fill.append(("rect", (-130, -10, 130, 150)))
        fill.append(("rect", (-152, -78, 152, -10)))
        stroke.append(("line", [(0, -78), (0, 150)]))
        fill.append(("ellipse", (-92, -150, -8, -78)))
        fill.append(("ellipse", (8, -150, 92, -78)))
    elif name == "МАКИЯЖ":
        fill.append(("rect", (-58, 30, 58, 160)))
        fill.append(("rect", (-46, -4, 46, 30)))
        fill.append(("poly", [P(-36, -4), P(-36, -86), P(36, -136), P(36, -4)]))
    elif name == "УХОД":
        fill.append(("rect", (-112, -78, 112, -22)))
        fill.append(("round", (-96, -22, 96, 128)))
        fill.append(("poly", star_pts(0, 52, 44, 10, 4, -90), 1))
    elif name == "ПАРФЮМ":
        fill.append(("round", (-104, -8, 104, 160)))
        fill.append(("rect", (-32, -72, 32, -8)))
        fill.append(("rect", (-52, -136, 52, -72)))
        fill.append(("poly", star_pts(0, 76, 40, 9, 4, -90), 1))
    elif name == "ОТЗЫВЫ":
        fill.append(("poly", star_pts(0, 8, 180, 76, 5, -90)))
    elif name == "ДОСТАВКА":
        fill.append(("rect", (-150, -70, 150, 130)))
        fill.append(("rect", (-34, -70, 34, 40), 1))
    elif name == "ЗАКАЗ":
        fill.append(("poly", [P(-118, -30), P(118, -30), P(140, 150), P(-140, 150)]))
        stroke.append(("arc", (-62, -130, 62, 40, 180, 360)))

def render_icon(name, theme):
    fill, stroke = [], []
    draw_icon(name, fill, stroke)
    w = 8 * S
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * w + 1, 2 * w + 1))
    outline = np.zeros((LOC * S, LOC * S), np.uint8)
    for group in sorted({(f[2] if len(f) > 2 else 0) for f in fill}):     # each group is outlined on its own
        m = Image.new("L", (LOC * S, LOC * S), 0)
        d = ImageDraw.Draw(m)
        for f in fill:
            if (f[2] if len(f) > 2 else 0) != group:
                continue
            kind, v = f[0], f[1]
            if kind == "poly": d.polygon(v, fill=255)
            elif kind == "rect": d.rectangle([P(v[0], v[1]), P(v[2], v[3])], fill=255)
            elif kind == "ellipse": d.ellipse([P(v[0], v[1]), P(v[2], v[3])], fill=255)
            elif kind == "round": d.rounded_rectangle([P(v[0], v[1]), P(v[2], v[3])], 34 * S, fill=255)
        a = np.asarray(m)
        outline = np.maximum(outline, np.clip(a.astype(int) - cv2.erode(a, k).astype(int), 0, 255).astype("uint8"))
    outline = Image.fromarray(outline)
    s = Image.new("L", (LOC * S, LOC * S), 0)
    sd = ImageDraw.Draw(s)
    for kind, v in stroke:
        if kind == "line": sd.line([P(*p) for p in v], fill=255, width=w)
        elif kind == "arc": sd.arc([P(v[0], v[1]), P(v[2], v[3])], v[4], v[5], fill=255, width=w)
    return Image.fromarray(np.maximum(np.asarray(outline), np.asarray(s)))

def cover(name, theme, out):
    T = THEMES[theme]
    img = background(T["bg"])
    ring = Image.new("L", (LOC * S, LOC * S), 0)
    ImageDraw.Draw(ring).ellipse([P(-440, -440 + 60), P(440, 440 + 60)], outline=255, width=2 * S)
    mask = Image.fromarray(np.maximum(np.asarray(ring), np.asarray(render_icon(name, theme))))
    layer = line_gradient(*T["line"])
    layer.putalpha(mask)
    layer = layer.resize((LOC, LOC), Image.LANCZOS)
    img = img.convert("RGBA")
    img.alpha_composite(layer, (CX - LOC // 2, CY - LOC // 2))
    img = img.convert("RGB")
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(SERIF, 56)
    widths = [d.textlength(c, font=f) for c in name]
    track = 18
    x = W / 2 - (sum(widths) + track * (len(name) - 1)) / 2
    for c, w in zip(name, widths):
        d.text((x, 1150), c, font=f, fill=T["text"])
        x += w + track
    d.text((W / 2, 1245), "flaner cosmetics", font=ImageFont.truetype(SERIF_IT, 34), fill=T["sub"], anchor="ma")
    img.save(out)
    return img

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "design/highlights"
    os.makedirs(out, exist_ok=True)
    for theme in THEMES:
        imgs = []
        for i, name in enumerate(ITEMS, 1):
            imgs.append(cover(name, theme, f"{out}/{theme}-{i:02d}-{name.lower()}.png"))
        sheet = Image.new("RGB", (4 * 360 + 50, 2 * 640 + 30), (255, 255, 255))
        for i, im in enumerate(imgs):
            sheet.paste(im.resize((360, 640), Image.LANCZOS), (10 + (i % 4) * 370, 10 + (i // 4) * 650))
        sheet.save(f"{out}/{theme}-sheet.png")
