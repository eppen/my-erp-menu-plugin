# ERP Menu Layout Modifier

这是一个 Chrome 浏览器扩展，主要用于优化特定 ERP 系统的菜单布局。它将原本的侧边栏菜单结构转换为更符合操作习惯的顶部一级菜单 + 二级子菜单的布局形式。

## 功能特点

*   **菜单重构**：自动将目标 ERP 系统的侧边栏菜单转换为顶部导航栏和子菜单容器。
*   **一键切换**：通过点击扩展图标弹出的窗口，可以随时启用或停用菜单调整功能，方便在原生布局和新布局之间切换。
*   **状态记忆**：记住用户的开启/关闭状态，下次打开浏览器时保持上次的选择。

## 安装说明

由于这是一个开发中的扩展（或私有扩展），需要通过"加载已解压的扩展程序"方式安装：

1.  下载本项目源代码到本地。
2.  打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/` 并回车。
3.  在页面右上角开启 **"开发者模式"**。
4.  点击左上角的 **"加载已解压的扩展程序"** 按钮。
5.  选择本项目所在的文件夹（包含 `manifest.json` 的目录）。
6.  安装完成后，建议将扩展图标固定在浏览器工具栏以便使用。

## 使用方法

1.  访问目标 ERP 系统（默认匹配地址：`http://60.190.250.202/*`）。
2.  扩展会自动运行并调整菜单布局。
3.  如果需要临时恢复原始菜单：
    *   点击浏览器工具栏上的扩展图标。
    *   点击 **"启用/停用"** 按钮（滑块）。
    *   页面会自动刷新以应用更改。

## 项目结构

```text
.
├── manifest.json        # 扩展配置文件 (Manifest V3)
├── content.js           # 注入页面的主要逻辑脚本，负责DOM操作和菜单重构
├── styles.css           # 注入页面的样式表
├── background.js        # 后台服务 Worker
├── popup.html           # 点击扩展图标显示的弹窗界面
├── popup.js             # 弹窗界面的交互逻辑
├── package.py           # 打包脚本，用于生成 .zip 发布包
├── generate_icons.*     # 图标生成辅助脚本 (Python/JS/HTML)
└── images/              # 存放扩展图标
```

## 开发与构建

### 图标生成
项目包含自动生成图标的脚本。如果更改了图标样式，可以使用 `generate_icons.py` 或 `generate_icons.html` 重新生成不同尺寸的图标文件。

### 打包（Chrome / Edge）
项目内置 `package.py` 打包脚本，用于生成可以直接上传到浏览器扩展商店的 zip 包。

- **同时打包 Chrome 和 Edge（推荐）**：

```bash
python package.py
```

- **仅打包 Chrome 插件**：

```bash
python package.py --target chrome
```

- **仅打包 Edge 插件**：

```bash
python package.py --target edge
```

脚本会自动读取 `manifest.json` 中的 `version` 字段，并生成类似下面的文件：

- `my-erp-menu-plugin-chrome-v1.1.1.zip`  （用于上传到 Chrome Web Store）
- `my-erp-menu-plugin-edge-v1.1.1.zip`    （用于上传到 Edge 外接程序商店）
