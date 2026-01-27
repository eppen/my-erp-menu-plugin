#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
打包浏览器插件
"""

import zipfile
from pathlib import Path

def package_plugin():
    """打包插件文件"""
    # 获取脚本所在目录
    plugin_dir = Path(__file__).parent.resolve()
    
    # 读取版本号
    manifest_path = plugin_dir / "manifest.json"
    import json
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    version = manifest.get('version', '1.0.0')
    
    # 需要包含的文件
    files_to_include = [
        'manifest.json',
        'background.js',
        'content.js',
        'popup.html',
        'popup.js',
        'styles.css',
    ]
    
    # 图标文件
    icon_files = [
        'images/icon-16.png',
        'images/icon-48.png',
        'images/icon-128.png',
    ]
    
    # 创建 zip 文件
    zip_filename = f"my-erp-menu-plugin-v{version}.zip"
    zip_path = plugin_dir / zip_filename
    
    print(f"正在打包插件 v{version}...")
    print(f"输出文件: {zip_filename}")
    
    with zipfile.ZipFile(str(zip_path), 'w', zipfile.ZIP_DEFLATED) as z:
        # 添加主要文件
        for file in files_to_include:
            file_path = plugin_dir / file
            if file_path.exists():
                z.write(str(file_path), file)
                print(f"  + {file}")
            else:
                print(f"  ! 警告: {file} 不存在")
        
        # 添加图标文件
        for icon_file in icon_files:
            icon_path = plugin_dir / icon_file
            if icon_path.exists():
                z.write(str(icon_path), icon_file)
                print(f"  + {icon_file}")
            else:
                print(f"  ! 警告: {icon_file} 不存在")
    
    print(f"\n打包完成: {zip_filename}")
    print(f"文件大小: {zip_path.stat().st_size / 1024:.2f} KB")

if __name__ == "__main__":
    package_plugin()