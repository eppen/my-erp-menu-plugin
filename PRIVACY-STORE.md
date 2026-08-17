# Privacy 页填写指南（Edge Partner Center）

在 Partner Center 左侧打开 **Privacy（隐私）**，按下面内容填写。  
公开隐私政策 URL（填到 Privacy Policy URL）：

```text
https://eppen.github.io/my-erp-menu-plugin/privacy.html
```

---

## 1. Single Purpose Description（单一用途）

```text
Transforms the left sidebar menu of designated ERP pages into a top navigation bar with a left sub-menu panel. Provides a local on/off switch, favorites, and search to improve menu navigation. Does not change browsing outside the declared host matches.
```

中文备忘（勿贴英文栏时可自用）：将指定 ERP 页面的左侧菜单改为顶部导航 + 左侧子菜单，并提供本地开关、收藏与搜索；仅在声明的主机范围内生效。

---

## 2. Permission justification（权限说明）

按 manifest 中出现的权限逐条粘贴：

### `storage`

```text
Stores local user preferences only: whether menu modification is enabled, favorite menu item labels, and horizontal menu collapse preference. Data stays in chrome.storage.sync on the user’s device and is not sent to developer servers.
```

### `activeTab`

```text
Used when the user toggles the feature from the extension popup, so the active ERP/demo tab can be notified to apply or restore the menu layout.
```

### `scripting`

```text
Supports injecting the extension’s layout scripts and styles into matched ERP/demo pages so the sidebar can be transformed into the top + sub-menu layout.
```

### Host / content script matches（若表单要求说明主机权限）

```text
Content scripts run only on declared hosts: specific ERP intranet/public IPs used by the target system, the public GitHub Pages demo (https://eppen.github.io/my-erp-menu-plugin/*), and localhost for development. The extension reads menu DOM on those pages locally to rebuild the UI and does not transmit page data to external servers.
```

---

## 3. Are you using remote code?（是否使用远程代码）

选择：

```text
No, I am not using remote code
```

本扩展全部逻辑在安装包内，无运行时从网络加载可执行脚本。

---

## 4. Data usage（数据使用）

### What user data do you plan to collect…（收集哪些用户数据）

建议勾选（以商店实际选项为准；若有「Website content」类）：

| 选项（常见英文） | 是否勾选 | 说明 |
| --- | --- | --- |
| Personally identifiable information | **否** | 不收集姓名/邮箱等 |
| Health / Financial / Authentication / Personal communications / Location / Web history | **否** | 均不涉及 |
| Website content | **是**（若有） | 本地读取菜单文案与结构以改造 UI；收藏的菜单名会写入浏览器 sync 存储 |
| User activity | **否**（除非商店把开关偏好算进去；一般不必） | 无行为分析上报 |

若选项中有 **None / Does not collect user data**，且商店允许：也可勾选「不收集」并在隐私政策中说明仅本地偏好——但因会读写页面菜单 DOM，更稳妥是勾选 **Website content** 并写明不上传。

### I certify that the following disclosures are true（认证声明）

按页面要求勾选全部适用认证项，确保与隐私政策一致，通常包括：

- 不出售用户数据  
- 不将数据用于与扩展单一用途无关的目的  
- 仅收集实现功能所必需的数据  
- 通过有限使用 / 最小化原则处理数据  

（以 Partner Center 当前勾选文案为准，全部勾选你能诚实保证的项。）

---

## 5. Privacy policy URL

```text
https://eppen.github.io/my-erp-menu-plugin/privacy.html
```

提交前请在浏览器打开确认可访问（需已开启 GitHub Pages）。

---

## 与本扩展行为对照（自查）

| 行为 | 事实 |
| --- | --- |
| 远程服务器 / 分析 SDK | 无 |
| 远程代码 | 无 |
| 本地存储 | `menuModificationEnabled`、`favoriteMenuItems`、`horizontalMenuCollapseEnabled` |
| 读取页面 | 仅匹配 URL 上的菜单 DOM |
| 传出数据 | 无 |
