# 生成 PWA 图标: 朱砂印章风「研」
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).parent.parent / "icons"; OUT.mkdir(exist_ok=True)
RED = (179, 57, 46, 255); WHITE = (255, 255, 255, 255)

def seal(size, pad_ratio=0.14, radius_ratio=0.22):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * radius_ratio)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=RED)
    f = None
    for fp in ("msyhbd.ttc", "msyh.ttc", "simhei.ttf", "simsun.ttc"):
        try:
            f = ImageFont.truetype(f"C:/Windows/Fonts/{fp}", int(size * (1 - 2 * pad_ratio)))
            break
        except OSError:
            continue
    d.text((size // 2, size // 2), "研", font=f, fill=WHITE, anchor="mm")
    return img

for name, s in [("icon-192.png", 192), ("icon-512.png", 512),
                ("apple-touch-icon.png", 180), ("favicon-32.png", 32)]:
    if name == "apple-touch-icon.png":
        img = seal(s, pad_ratio=0.16, radius_ratio=0.0)  # iOS 自带圆角遮罩
    else:
        img = seal(s)
    img.save(OUT / name)
    print("saved", name, s)
