#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
打包浏览器插件

支持输出：
* Chrome 商店安装包
* Edge 外接程序商店安装包
* Firefox 附加组件安装包（.xpi）
"""

import argparse
import json
import zipfile
from pathlib import Path


def _load_version(plugin_dir: Path) -> str:
    """从 manifest.json 中读取版本号"""
    manifest_path = plugin_dir / "manifest.json"
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    return manifest.get("version", "1.0.0")


def _load_manifest_for_target(plugin_dir: Path, target: str) -> tuple[str, dict]:
    """读取目标浏览器对应的 manifest 内容"""
    if target == "firefox":
        manifest_path = plugin_dir / "manifest.firefox.json"
    else:
        manifest_path = plugin_dir / "manifest.json"

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    manifest["version"] = _load_version(plugin_dir)
    return manifest_path.name, manifest


def _collect_files(plugin_dir: Path):
    """返回需要打包的文件列表"""
    files_to_include = [
        "background.js",
        "content.js",
        "popup.html",
        "popup.js",
        "styles.css",
    ]

    icon_files = [
        "images/icon-16.png",
        "images/icon-48.png",
        "images/icon-128.png",
    ]

    return files_to_include, icon_files


def package_for_target(target: str) -> Path:
    """
    为指定目标（chrome / edge / firefox）打包

    Chrome、Edge 使用 service_worker 版 manifest；
    Firefox 使用 manifest.firefox.json（background.scripts）。
    """
    # 获取脚本所在目录
    plugin_dir = Path(__file__).parent.resolve()

    version = _load_version(plugin_dir)
    manifest_source, manifest = _load_manifest_for_target(plugin_dir, target)
    files_to_include, icon_files = _collect_files(plugin_dir)

    # 输出目录：dist/<target>/
    dist_root = plugin_dir / "dist"
    dist_dir = dist_root / target
    dist_dir.mkdir(parents=True, exist_ok=True)

    # 不同目标使用不同的文件名，方便区分
    if target == "chrome":
        zip_filename = f"my-erp-menu-plugin-chrome-v{version}.zip"
    elif target == "edge":
        zip_filename = f"my-erp-menu-plugin-edge-v{version}.zip"
    elif target == "firefox":
        zip_filename = f"my-erp-menu-plugin-firefox-v{version}.xpi"
    else:
        raise ValueError(f"未知打包目标: {target}")

    zip_path = dist_dir / zip_filename

    print(f"正在打包 {target} 插件 v{version}...")
    print(f"输出文件: {zip_path.relative_to(plugin_dir)}")

    with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
        print(f"  + manifest.json (from {manifest_source})")

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
    print("-" * 40)

    return zip_path


def main():
    parser = argparse.ArgumentParser(description="打包 ERP Menu Layout Modifier 扩展")
    parser.add_argument(
        "--target",
        choices=["chrome", "edge", "firefox", "all"],
        default="all",
        help="打包目标浏览器（默认 all，含 firefox）",
    )
    args = parser.parse_args()

    targets = []
    if args.target == "all":
        targets = ["chrome", "edge", "firefox"]
    else:
        targets = [args.target]

    print(f"打包目标: {', '.join(targets)}")
    print()

    for t in targets:
        package_for_target(t)


if __name__ == "__main__":
    main()