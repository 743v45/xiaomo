#!/usr/bin/env python3
"""生成 VOLT NOIR 风格齿轮 PNG(白色描边、透明底,4x 超采样抗锯齿)"""
from PIL import Image, ImageDraw
import math

S = 4            # 超采样倍数
SIZE = 240       # 输出尺寸 px
W = SIZE * S     # 画布 960
TEETH = 20       # 齿数 → 每档旋转 360/20 = 18°
R_OUT = 100 * S  # 齿顶半径
R_RIM = 84 * S   # 轮辋外半径
RIM_W = 7 * S    # 轮辋描边宽
R_HUB = 24 * S   # 轴孔半径
SPOKE_W = 9 * S  # 辐条宽
ALPHA = 150      # 白色不透明度 ≈ 59%

img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
c = W / 2
white = (255, 255, 255, ALPHA)

# 齿:每 18° 一个梯形齿(齿高 = R_OUT - R_RIM + 2S)
for i in range(TEETH):
    half = 4.5
    a0 = math.radians(i * 360 / TEETH - half)
    a1 = math.radians(i * 360 / TEETH + half)
    r0, r1 = R_RIM - 2 * S, R_OUT
    pts = [
        (c + r0 * math.cos(a0), c + r0 * math.sin(a0)),
        (c + r1 * math.cos(a0), c + r1 * math.sin(a0)),
        (c + r1 * math.cos(a1), c + r1 * math.sin(a1)),
        (c + r0 * math.cos(a1), c + r0 * math.sin(a1)),
    ]
    d.polygon(pts, fill=white)

# 轮辋(圆环描边)
d.ellipse([c - R_RIM, c - R_RIM, c + R_RIM, c + R_RIM], outline=white, width=RIM_W)

# 辐条 6 根
for i in range(6):
    a = math.radians(i * 60 + 30)
    x1, y1 = c + R_HUB * math.cos(a), c + R_HUB * math.sin(a)
    x2, y2 = c + (R_RIM - RIM_W) * math.cos(a), c + (R_RIM - RIM_W) * math.sin(a)
    d.line([(x1, y1), (x2, y2)], fill=white, width=SPOKE_W)

# 轴孔环
hub_w = 5 * S
d.ellipse([c - R_HUB, c - R_HUB, c + R_HUB, c + R_HUB], outline=white, width=hub_w)

img = img.resize((SIZE, SIZE), Image.LANCZOS)
import os
os.makedirs("app/assets", exist_ok=True)
img.save("app/assets/gear.png")

# 预览:放在 panel 底色上
bg = Image.new("RGBA", (280, 280), (20, 22, 28, 255))
bg.alpha_composite(img, (20, 20))
bg.convert("RGB").save("/tmp/gear_preview.jpg", quality=92)
print("saved app/assets/gear.png", img.size)
