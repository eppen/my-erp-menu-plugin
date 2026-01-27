#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成浏览器插件所需的图标文件
"""

try:
    from PIL import Image, ImageDraw
    from pathlib import Path
    import os
except ImportError:
    print("需要安装 Pillow 库: pip install Pillow")
    exit(1)

def create_icon(size):
    """创建指定尺寸的图标"""
    # 创建图像
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 计算缩放比例
    scale = size / 128
    
    # 绘制背景圆形
    margin = 4 * scale
    radius = (size / 2) - margin
    center = size / 2
    draw.ellipse(
        [center - radius, center - radius, center + radius, center + radius],
        fill=(45, 140, 240, 255)  # #2d8cf0
    )
    
    # 绘制网格线
    grid_color = (255, 255, 255, 51)  # 20% 透明度
    grid_width = max(1, int(1.5 * scale))
    
    # 水平线
    for y in [40, 64, 88]:
        y_pos = y * scale
        draw.line([(32 * scale, y_pos), (96 * scale, y_pos)], 
                 fill=grid_color, width=grid_width)
    
    # 垂直线
    for x in [40, 64, 88]:
        x_pos = x * scale
        draw.line([(x_pos, 32 * scale), (x_pos, 96 * scale)], 
                 fill=grid_color, width=grid_width)
    
    # 绘制菜单项（三个矩形）
    menu_color = (255, 255, 255, 255)
    menu_width = max(1, int(2 * scale))
    corner_radius = max(1, int(2 * scale))
    
    # 菜单项1
    y1 = 42 * scale
    draw.rounded_rectangle(
        [36 * scale, y1, 92 * scale, y1 + 8 * scale],
        radius=corner_radius,
        fill=menu_color,
        outline=menu_color,
        width=menu_width
    )
    
    # 菜单项2
    y2 = 60 * scale
    draw.rounded_rectangle(
        [36 * scale, y2, 92 * scale, y2 + 8 * scale],
        radius=corner_radius,
        fill=menu_color,
        outline=menu_color,
        width=menu_width
    )
    
    # 菜单项3（较短）
    y3 = 78 * scale
    draw.rounded_rectangle(
        [36 * scale, y3, 76 * scale, y3 + 8 * scale],
        radius=corner_radius,
        fill=menu_color,
        outline=menu_color,
        width=menu_width
    )
    
    # 绘制调整箭头
    arrow_size = 8 * scale
    arrow_x = 82 * scale
    arrow_y = 64 * scale
    
    # 右箭头
    arrow_points = [
        (arrow_x, arrow_y),
        (arrow_x + arrow_size, arrow_y - arrow_size / 2),
        (arrow_x + arrow_size, arrow_y + arrow_size / 2)
    ]
    draw.polygon(arrow_points, fill=menu_color)
    
    # 绘制调整指示器（右上角的小图标）
    indicator_size = 8 * scale
    indicator_x = 100 * scale
    indicator_y = 28 * scale
    
    # 黄色圆圈
    draw.ellipse(
        [indicator_x - indicator_size, indicator_y - indicator_size,
         indicator_x + indicator_size, indicator_y + indicator_size],
        fill=(255, 215, 0, 255),  # #ffd700
        outline=menu_color,
        width=menu_width
    )
    
    # 向上箭头
    arrow_indicator_size = 4 * scale
    draw.line(
        [(indicator_x - arrow_indicator_size, indicator_y),
         (indicator_x, indicator_y - arrow_indicator_size),
         (indicator_x + arrow_indicator_size, indicator_y)],
        fill=menu_color,
        width=max(1, int(2 * scale))
    )
    draw.line(
        [(indicator_x, indicator_y - arrow_indicator_size),
         (indicator_x, indicator_y + arrow_indicator_size)],
        fill=menu_color,
        width=max(1, int(2 * scale))
    )
    
    return img

def main():
    """生成所有尺寸的图标"""
    # 获取脚本所在目录
    script_dir = Path(__file__).parent.resolve()
    images_dir = script_dir / "images"
    
    # 确保 images 目录存在
    images_dir.mkdir(exist_ok=True)
    
    sizes = [16, 48, 128]
    
    print("正在生成图标...")
    for size in sizes:
        icon = create_icon(size)
        filename = images_dir / f"icon-{size}.png"
        icon.save(str(filename), "PNG")
        print(f"[OK] 已生成 {filename.name} ({size}x{size})")
    
    print("\n所有图标生成完成！")

if __name__ == "__main__":
    main()