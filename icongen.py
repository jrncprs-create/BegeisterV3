from PIL import Image, ImageDraw
import math

def make(S):
    img = Image.new("RGB", (S, S), (0, 0, 0))
    d = ImageDraw.Draw(img)
    c = S / 2
    w = max(3, int(round(S * 0.072)))
    for ang, Lf in [(90, 0.40), (30, 0.35), (150, 0.35)]:
        a = math.radians(ang)
        L = S * Lf
        dx = math.cos(a) * L
        dy = math.sin(a) * L
        d.line([c - dx, c - dy, c + dx, c + dy], fill=(255, 255, 255), width=w)
    return img

for s, n in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png"), (32, "favicon-32.png")]:
    make(s).save(n)
print("done")
