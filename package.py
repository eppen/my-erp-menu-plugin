#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
打包浏览器插件

流程：
1. 默认先跑 `node scripts/build.js`，用 esbuild 把 JS/CSS 压到 build/
2. 再从 build/ 打出各浏览器商店安装包

支持输出：
* Chrome 商店安装包
* Edge 外接程序商店安装包
* Firefox 附加组件安装包（.xpi）
"""

import argparse
import json
import subprocess
import sys
import zipfile
from pathlib import Path


def _plugin_dir() -> Path:
    return Path(__file__).parent.resolve()


def _load_version(plugin_dir: Path) -> str:
    """从根目录 manifest.json 中读取版本号（源码权威）"""
    manifest_path = plugin_dir / "manifest.json"
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    return manifest.get("version", "1.0.0")


def _load_manifest_for_target(plugin_dir: Path, target: str) -> tuple[str, dict]:
    """读取目标浏览器对应的 manifest 内容（仍取自源码，不进 minify）"""
    if target == "firefox":
        manifest_path = plugin_dir / "manifest.firefox.json"
    else:
        manifest_path = plugin_dir / "manifest.json"

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    manifest["version"] = _load_version(plugin_dir)
    return manifest_path.name, manifest


def _collect_files():
    """返回需要从 build/ 打进包的文件列表"""
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


def run_build(plugin_dir: Path, no_minify: bool = False) -> None:
    """调用 esbuild 构建脚本，产物写入 build/"""
    build_js = plugin_dir / "scripts" / "build.js"
    if not build_js.exists():
        raise FileNotFoundError(f"找不到构建脚本: {build_js}")

    cmd = ["node", str(build_js)]
    if no_minify:
        cmd.append("--no-minify")

    print("正在构建（esbuild）...", flush=True)
    print(f"  {' '.join(cmd)}", flush=True)
    result = subprocess.run(cmd, cwd=str(plugin_dir))
    if result.returncode != 0:
        raise RuntimeError("esbuild 构建失败，已中止打包")
    print(flush=True)


def package_for_target(target: str, build_dir: Path) -> Path:
    """
    为指定目标（chrome / edge / firefox）打包

    Chrome、Edge 使用 service_worker 版 manifest；
    Firefox 使用 manifest.firefox.json（background.scripts）。
    脚本与样式取自 build/（已 minify）。
    """
    plugin_dir = _plugin_dir()

    if not build_dir.is_dir():
        raise FileNotFoundError(
            f"缺少构建目录 {build_dir}，请先运行: npm run build"
        )

    version = _load_version(plugin_dir)
    manifest_source, manifest = _load_manifest_for_target(plugin_dir, target)
    files_to_include, icon_files = _collect_files()

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

        # 添加主要文件（来自 build/）
        for file in files_to_include:
            file_path = build_dir / file
            if file_path.exists():
                z.write(str(file_path), file)
                print(f"  + {file} (from build/)")
            else:
                print(f"  ! 警告: build/{file} 不存在")

        # 添加图标文件
        for icon_file in icon_files:
            icon_path = build_dir / icon_file
            if icon_path.exists():
                z.write(str(icon_path), icon_file)
                print(f"  + {icon_file} (from build/)")
            else:
                print(f"  ! 警告: build/{icon_file} 不存在")

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
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="跳过 esbuild，直接使用已有 build/（需事先 npm run build）",
    )
    parser.add_argument(
        "--no-minify",
        action="store_true",
        help="构建时不压缩（传给 scripts/build.js）",
    )
    args = parser.parse_args()

    plugin_dir = _plugin_dir()
    build_dir = plugin_dir / "build"

    if not args.skip_build:
        try:
            run_build(plugin_dir, no_minify=args.no_minify)
        except FileNotFoundError as e:
            print(f"错误: {e}", file=sys.stderr)
            print("提示: 需要本机可用的 node，并先执行 npm install", file=sys.stderr)
            sys.exit(1)
        except OSError as e:
            print(f"错误: 无法启动 node（{e}）", file=sys.stderr)
            print("提示: 请先安装 Node.js，并在项目根目录执行 npm install", file=sys.stderr)
            sys.exit(1)
        except RuntimeError as e:
            print(f"错误: {e}", file=sys.stderr)
            sys.exit(1)

    targets = []
    if args.target == "all":
        targets = ["chrome", "edge", "firefox"]
    else:
        targets = [args.target]

    print(f"打包目标: {', '.join(targets)}")
    print()

    try:
        for t in targets:
            package_for_target(t, build_dir)
    except FileNotFoundError as e:
        print(f"错误: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
