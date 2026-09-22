#!/usr/bin/env python3
"""生成蓝牙 logo PNG ×4 态(ᛒ 形线标,4x 超采样)"""
from PIL import Image, ImageDraw
import os

S = 4
SIZE = 96
W = SIZE * S
COLORS = {
    'off':  (138, 143, 152, 255),   # 灰
    'scan': (255, 179, 0, 255),     # 琥珀(扫描/连接中)
    'ok':   (238, 255, 0, 255),     # lime
    'fail': (255, 77, 94, 255),     # 红
}
LW = 8 * S

# ᛒ 形(蓝牙起源符):竖线 + 上下两个右向尖角,24 网格坐标
V = [(12, 3), (12, 23)]
UP1, UP2 = (12, 3), (19, 9)
DN1, DN2 = (12, 13), (19, 9)
UP3, UP4 = (12, 13), (19, 19)
DN3, DN4 = (12, 13), (19, 19)

def draw_logo(color):
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    sc = lambda pts: [(x * S, y * S) for x, y in pts]
    d.line(sc(V), fill=color, width=LW)
    d.line(sc([(12, 3), (19, 9)]), fill=color, width=LW)      # 上尖:顶→右
    d.line(sc([(19, 9), (12, 14)]), fill=color, width=LW)     # 右→中
    d.line(sc([(12, 14), (19, 20)]), fill=color, width=LW)    # 中→右下
    d.line(sc([(19, 20), (12, 23)]), fill=color, width=LW)    # 右下→底
    return img.resize((SIZE, SIZE), Image.LANCZOS)

os.makedirs('app/assets', exist_ok=True)
for name, color in COLORS.items():
    draw_logo(color).save(f'app/assets/bt-{name}.png')
print('4 bt logos saved')
