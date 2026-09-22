#!/usr/bin/env python3
"""生成 tabBar 线性图标 ×2 态(普通灰 #8A8F98 / 选中 lime #EEFF00),4x 超采样"""
from PIL import Image, ImageDraw
import math, os

S = 4
SIZE = 96
W = SIZE * S
NORMAL = (138, 143, 152, 255)   # #8A8F98
ACTIVE = (238, 255, 0, 255)     # #EEFF00
LW = 7 * S  # 线宽

os.makedirs("app/assets", exist_ok=True)

def canvas():
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)

def save(img, name):
    img.resize((SIZE, SIZE), Image.LANCZOS).save(f"app/assets/{name}.png")

def bolt(d, color):  # 闪电(运动)
    pts = [(52, 8), (24, 52), (44, 52), (36, 88), (72, 40), (50, 40), (62, 8)]
    d.polygon([(x * S, y * S) for x, y in pts], fill=color)

def intervals(d, color):  # 间歇条形(训练)
    for i, (x, h) in enumerate([(14, 40), (40, 72), (66, 28)]):
        d.rounded_rectangle([x * S, (96 - h) * S, (x + 16) * S, 88 * S], radius=7 * S, fill=color)

def clock(d, color):  # 时钟(历史)
    d.ellipse([10 * S, 10 * S, 86 * S, 86 * S], outline=color, width=LW)
    d.line([(48 * S, 48 * S), (48 * S, 24 * S)], fill=color, width=LW)
    d.line([(48 * S, 48 * S), (68 * S, 60 * S)], fill=color, width=LW)

def person(d, color):  # 人形(我的)
    d.ellipse([(48 - 17) * S, 10 * S, (48 + 17) * S, 44 * S], fill=color)
    d.pieslice([10 * S, 50 * S, 86 * S, 122 * S], 180, 360, fill=color)

ICONS = {"tab-dash": bolt, "tab-train": intervals, "tab-history": clock, "tab-profile": person}
for name, fn in ICONS.items():
    img, d = canvas()
    fn(d, NORMAL); save(img, name)
    img, d = canvas()
    fn(d, ACTIVE); save(img, name + "-on")
print("8 tab icons saved")
