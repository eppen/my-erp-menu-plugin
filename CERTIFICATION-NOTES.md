# Notes for certification（Edge / Partner Center）

重新提交扩展时，把下面英文内容粘贴到 **Submission Options → Notes for certification**。

---

## English (paste into Partner Center)

```text
Extension name: ERP Menu Layout Modifier
Version: 1.2.24

Purpose:
Transforms a left sidebar ERP menu into a top navigation bar + left sub-menu layout.
When enabled, it also merges the original page header actions (icons / user dropdown) into the extension top bar so the extra header row is removed.

PUBLIC DEMO (no login required):
https://eppen.github.io/my-erp-menu-plugin/demo/

Privacy policy:
https://eppen.github.io/my-erp-menu-plugin/privacy.html

Test steps:
1. Install the extension.
2. Open the demo URL above and refresh the page.
3. Expected result:
   - The dark left sidebar disappears.
   - A blue top menu bar appears.
   - A left sub-menu panel appears with items under the first top tab.
   - The original white header row (icons / user menu) disappears and those controls appear inside the blue top bar (default: right side).
4. Click other top-level tabs (e.g. 系统管理 / 采购管理) — the left sub-menu should switch.
5. Click a leaf item (e.g. 用户管理) — the content title should update (simulates navigation).
6. Open the extension popup:
   - Use the "顶栏按钮位置" dropdown to switch header-actions between Right / Left — they should move on the top bar without reload.
   - Turn OFF "启用菜单调整" — the original left sidebar and original white header should return.
7. Optional: narrow the browser window — excess top tabs should collapse into a "更多" menu next to the visible tabs; the dropdown should open under that button.

No account / password is required for the demo page.
Production matches also include internal ERP hosts that reviewers cannot reach; please use the public demo URL above for certification.
```

---

## 中文备忘（勿贴到商店时可自用）

- 当前版本：`1.2.24`
- Demo 地址：`https://eppen.github.io/my-erp-menu-plugin/demo/`
- 隐私政策：`https://eppen.github.io/my-erp-menu-plugin/privacy.html`
- 需先把本仓库推送到 GitHub，并开启 GitHub Pages（Source: Deploy from branch `master` / `main`，Folder: `/ (root)`）
- 本地预览：在项目根目录执行 `python -m http.server 8080`，然后访问 `http://127.0.0.1:8080/demo/`（manifest 已匹配 localhost）
- 本版相对提审要点：顶栏合并原 header 操作区、弹窗可切换左/右位置、「更多」紧跟模块菜单
