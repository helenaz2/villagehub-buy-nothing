# Draws the Curbside mark (a paper tag on a terracotta string) and writes every icon size Expo needs.
# Usage: python3 make_icons.py <assets/images dir> <preview.png>
import sys, math
from PIL import Image, ImageDraw, ImageFont

out, preview = sys.argv[1], sys.argv[2]
FOREST, PAPER, TERRA, SAND = (30, 59, 47), (244, 239, 230), (196, 87, 58), (227, 216, 195)
SS = 4  # supersample


def tag_layer(size, body, string, hole_fill, scale=1.0, cx=0.5, cy=0.56, angle=-12, reach=1.0):
    """A luggage tag centred at (cx, cy), drawn on a transparent canvas of `size`."""
    S = size * SS
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    u = S * scale / 1024  # design units are 1024 per icon
    w, h, cham, r = 380 * u, 520 * u, 120 * u, 46 * u
    x0, y0 = S * cx - w / 2, S * cy - h / 2 + 30 * u
    # body: rounded bottom corners, chamfered top
    pts = [(x0 + cham, y0), (x0 + w - cham, y0), (x0 + w, y0 + cham), (x0 + w, y0 + h - r),
           (x0 + w - r, y0 + h), (x0 + r, y0 + h), (x0, y0 + h - r), (x0, y0 + cham)]
    d.polygon(pts, fill=body)
    d.ellipse([x0 + w - 2 * r, y0 + h - 2 * r, x0 + w, y0 + h], fill=body)
    d.ellipse([x0, y0 + h - 2 * r, x0 + 2 * r, y0 + h], fill=body)
    # hole with a terracotta grommet
    hx, hy, hr = S * cx, y0 + 105 * u, 40 * u
    d.ellipse([hx - hr - 16 * u, hy - hr - 16 * u, hx + hr + 16 * u, hy + hr + 16 * u], fill=string)
    d.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=hole_fill)
    # two text rules on the tag
    for i, frac in enumerate((0.62, 0.78)):
        lw = (0.56 if i == 0 else 0.38) * w
        ly = y0 + h * frac
        d.rounded_rectangle([S * cx - w * 0.28, ly - 15 * u, S * cx - w * 0.28 + lw, ly + 15 * u], radius=15 * u, fill=SAND if body == PAPER else hole_fill)
    im = im.rotate(angle, resample=Image.BICUBIC, center=(hx, hy))
    # string: an arc from the hole up and out of frame, drawn after rotation so it hangs
    d = ImageDraw.Draw(im)
    ang = math.radians(-angle)
    rx, ry = hx, hy
    sw = 30 * u
    pts = []
    for t in [i / 40 * reach for i in range(41)]:
        x = rx + (0 - 40 * t + 260 * t * t) * u
        y = ry - (470 * t) * u
        pts.append((x, y))
    d.line(pts, fill=string, width=int(sw), joint='curve')
    for (ex, ey) in (pts[0], pts[-1]):
        d.ellipse([ex - sw / 2, ey - sw / 2, ex + sw / 2, ey + sw / 2], fill=string)
    return im.resize((size, size), Image.LANCZOS)


def square(size, bg, **kw):
    im = Image.new('RGBA', (size, size), bg + (255,))
    t = tag_layer(size, **kw)
    im.alpha_composite(t)
    return im


def rounded(im, radius_frac=0.225):
    S = im.width * SS
    m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], radius=S * radius_frac, fill=255)
    out_im = im.copy()
    out_im.putalpha(m.resize(im.size, Image.LANCZOS))
    return out_im


icon = square(1024, FOREST, body=PAPER, string=TERRA, hole_fill=FOREST, scale=1.08)
icon.convert('RGB').save(f'{out}/icon.png')

# Android adaptive: foreground inside the 66% safe zone, solid background, monochrome glyph.
fg = tag_layer(512, body=PAPER, string=TERRA, hole_fill=FOREST, scale=0.62)
fg.save(f'{out}/android-icon-foreground.png')
Image.new('RGBA', (512, 512), FOREST + (255,)).save(f'{out}/android-icon-background.png')
mono = tag_layer(512, body=(255, 255, 255), string=(255, 255, 255), hole_fill=(0, 0, 0, 0), scale=0.62)
mono.save(f'{out}/android-icon-monochrome.png')

# Splash: the mark in forest on the paper splash background.
splash = tag_layer(400, body=FOREST, string=TERRA, hole_fill=PAPER, scale=0.95, cy=0.6, reach=0.62)
splash.save(f'{out}/splash-icon.png')

fav = rounded(square(192, FOREST, body=PAPER, string=TERRA, hole_fill=FOREST))
fav.resize((48, 48), Image.LANCZOS).save(f'{out}/favicon.png')

# Preview sheet: iOS-style rounded icon at several sizes, adaptive circle, splash on paper, favicon.
sheet = Image.new('RGBA', (1200, 420), PAPER + (255,))
x = 20
for s in (300, 120, 60):
    r = rounded(icon.resize((s, s), Image.LANCZOS))
    sheet.alpha_composite(r, (x, 40)); x += s + 30
circ = Image.new('RGBA', (512, 512), FOREST + (255,)); circ.alpha_composite(fg)
m = Image.new('L', (512, 512), 0); ImageDraw.Draw(m).ellipse([0, 0, 511, 511], fill=255)
circ.putalpha(m); circ = circ.resize((200, 200), Image.LANCZOS)
sheet.alpha_composite(circ, (x, 40)); x += 230
sheet.alpha_composite(splash.resize((200, 200), Image.LANCZOS), (x, 40)); x += 230
sheet.alpha_composite(Image.open(f'{out}/favicon.png').convert('RGBA'), (x, 40))
sheet.alpha_composite(mono.resize((120, 120)), (x, 140))
sheet.save(preview)
print('ok')
