import os, math, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

W, H = 1080, 1350
OUT = os.path.join(os.path.dirname(__file__), "art-samples")
os.makedirs(OUT, exist_ok=True)

def field(x, y, seed):
    # pseudo-ruis uit gestapelde sinussen
    random.seed(seed)
    v = 0.0
    for i in range(4):
        fx = 0.0008 * (1 + i * 1.7)
        fy = 0.0008 * (1 + i * 1.3)
        px = random.uniform(0, 6.28); py = random.uniform(0, 6.28)
        v += math.sin(x * fx + px) * math.cos(y * fy + py) / (i + 1)
    return v

def vignette(img, strength=0.85):
    v = Image.new("L", (img.width, img.height), 0)
    d = ImageDraw.Draw(v)
    d.ellipse([-img.width*0.2, -img.height*0.2, img.width*1.2, img.height*1.2], fill=255)
    v = v.filter(ImageFilter.GaussianBlur(img.width*0.18))
    black = Image.new("RGB", img.size, (0, 0, 0))
    return Image.composite(img, black, v.point(lambda p: int(p*strength + 255*(1-strength))))

# 1) FLOW FIELD — fijne stromende lijnen
def flow(seed=1):
    base = Image.new("RGB", (W, H), (8, 8, 9))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    random.seed(seed)
    for _ in range(1400):
        x = random.uniform(0, W); y = random.uniform(0, H)
        tone = random.randint(120, 255); a = random.randint(8, 26)
        pts = [(x, y)]
        for _ in range(random.randint(40, 120)):
            ang = field(x, y, seed) * 3.14159
            x += math.cos(ang) * 6; y += math.sin(ang) * 6
            if not (0 <= x < W and 0 <= y < H): break
            pts.append((x, y))
        if len(pts) > 2:
            d.line(pts, fill=(tone, tone, tone, a), width=1)
    img = Image.alpha_composite(base.convert("RGBA"), layer).convert("RGB")
    return vignette(img)

# 2) NEBULA — zachte donkere wolken
def nebula(seed=2):
    img = Image.new("RGB", (W, H), (6, 6, 7))
    blob = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(blob)
    random.seed(seed)
    for _ in range(9):
        cx = random.uniform(0, W); cy = random.uniform(0, H)
        r = random.uniform(W*0.15, W*0.5); br = random.randint(70, 180)
        d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=br)
    blob = blob.filter(ImageFilter.GaussianBlur(W*0.10))
    light = Image.new("RGB", (W, H), (210, 212, 220))
    img = Image.composite(light, img, blob.point(lambda p: int(p*0.55)))
    img = ImageChops.multiply(img, Image.new("RGB", (W, H), (255, 255, 255)))
    return vignette(img, 0.9)

# 3) SHARDS — low-poly scherven
def shards(seed=3):
    img = Image.new("RGB", (W, H), (10, 10, 11))
    d = ImageDraw.Draw(img, "RGBA")
    random.seed(seed)
    for _ in range(220):
        cx = random.uniform(0, W); cy = random.uniform(0, H)
        s = random.uniform(40, 240)
        pts = [(cx+random.uniform(-s, s), cy+random.uniform(-s, s)) for _ in range(3)]
        t = random.randint(14, 235)
        d.polygon(pts, fill=(t, t, t, random.randint(18, 60)))
    return vignette(img.filter(ImageFilter.GaussianBlur(0.6)))

# 4) CONTOUR — topografische lijnen
def contour(seed=4):
    img = Image.new("RGB", (W, H), (7, 7, 8))
    d = ImageDraw.Draw(img, "RGBA")
    random.seed(seed)
    for k in range(60):
        pts = []
        base_y = (k/60)*H*1.2 - H*0.1
        for x in range(0, W+10, 8):
            y = base_y + 120*field(x, base_y, seed) + 30*math.sin(x*0.01 + k)
            pts.append((x, y))
        tone = 90 + int(120*(k/60))
        d.line(pts, fill=(tone, tone, tone, 90), width=1)
    return vignette(img)

# 5) STREAKS — lange lichtstrepen (long exposure)
def streaks(seed=5):
    img = Image.new("RGB", (W, H), (5, 5, 6))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    random.seed(seed)
    ang = random.uniform(-0.5, 0.5)
    for _ in range(60):
        x = random.uniform(-W*0.2, W*1.2); y = random.uniform(0, H)
        ln = random.uniform(W*0.3, W*1.1); t = random.randint(120, 255)
        x2 = x+math.cos(ang)*ln; y2 = y+math.sin(ang)*ln
        d.line([(x, y), (x2, y2)], fill=(t, t, t, random.randint(20, 70)), width=random.randint(1, 3))
    layer = layer.filter(ImageFilter.GaussianBlur(1.4))
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    return vignette(img)

# 6) DOTFIELD — korrelig dichtheidsveld
def dotfield(seed=6):
    img = Image.new("RGB", (W, H), (9, 9, 10))
    d = ImageDraw.Draw(img, "RGBA")
    random.seed(seed)
    for _ in range(26000):
        x = random.uniform(0, W); y = random.uniform(0, H)
        dens = (field(x, y, seed)+1)/2
        if random.random() < dens*0.7:
            t = random.randint(120, 255)
            d.ellipse([x, y, x+1.6, y+1.6], fill=(t, t, t, random.randint(40, 120)))
    return vignette(img)

styles = [("flow", flow), ("nebula", nebula), ("shards", shards),
          ("contour", contour), ("streaks", streaks), ("dotfield", dotfield)]
for i, (name, fn) in enumerate(styles, 1):
    fn(i).save(os.path.join(OUT, f"art-{i}-{name}.jpg"), quality=88)
    print(name, "ok")
print("done")
