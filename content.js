// 全局状态：是否启用菜单调整
let isMenuModificationEnabled = true;

// 收藏列表
let favoriteMenuItems = [];

// 当前激活的顶级菜单名称
let currentTopLevelMenuName = null;

// 顶栏操作区位置：'left' | 'right'
let headerActionsPosition = 'right';

// 内容区 tab 与左侧菜单同步
let lastSyncedTagKey = null;
let tagNavObserver = null;
let tagNavSyncTimer = null;
let tagNavPollTimer = null;
let tagNavObservedRoot = null;
let pendingSyncInfo = null;
const PENDING_SYNC_TTL = 2000;
// 收藏/搜索等已按菜单项同步左侧后，挂起自动 tab→菜单同步，直到用户手动点 tab
let autoTagSyncSuspended = false;
let suspendedMenuHint = null;
// 菜单/搜索/收藏打开时记录的 tab 上下文，供反向同步优先使用
const tabContextMap = Object.create(null);
const TAB_CONTEXT_MAX = 200;
const TAB_CONTEXT_TTL = 30 * 60 * 1000;

function setPendingSyncInfo(info) {
    if (!info) return;
    pendingSyncInfo = Object.assign({}, info, { _ts: Date.now() });
}

function suspendAutoTagSync(topLevelMenu, itemText) {
    autoTagSyncSuspended = true;
    suspendedMenuHint = {
        title: itemText || topLevelMenu || '',
        topLevelMenu: topLevelMenu || '',
        text: itemText || ''
    };
}

function resumeAutoTagSync() {
    autoTagSyncSuspended = false;
    suspendedMenuHint = null;
}

function normalizeHrefKey(href) {
    if (!href) return '';
    return String(href).replace(/^\.\//, '').replace(/^\//, '').replace(/\/+$/, '');
}

// 生成索引 key。不含 title（同名页面会互相覆盖），只使用较稳定的 id/name/key/href
function tabContextIndexKeys(ctx) {
    const keys = [];
    if (!ctx) return keys;
    if (ctx.id) keys.push('id:' + ctx.id);
    if (ctx.name) {
        keys.push('name:' + ctx.name);
        keys.push('key:' + ctx.name);
    }
    if (ctx.key) {
        keys.push('key:' + ctx.key);
        keys.push('name:' + ctx.key);
        if (String(ctx.key).indexOf('tag-nav-') === 0) {
            const stripped = String(ctx.key).replace(/^tag-nav-/, '');
            if (stripped) {
                keys.push('key:' + stripped);
                keys.push('name:' + stripped);
            }
        }
    }
    if (ctx.id && String(ctx.id).indexOf('tag-nav-') === 0) {
        const stripped = String(ctx.id).replace(/^tag-nav-/, '');
        if (stripped) {
            keys.push('key:' + stripped);
            keys.push('name:' + stripped);
        }
    }
    const hrefKey = normalizeHrefKey(ctx.href);
    if (hrefKey) keys.push('href:' + hrefKey);
    return Array.from(new Set(keys));
}

function forgetTabContextEntry(entry) {
    if (!entry || !entry._keys) return;
    entry._keys.forEach(k => {
        if (tabContextMap[k] === entry) delete tabContextMap[k];
    });
    entry._keys = [];
}

function pruneTabContextMap() {
    const now = Date.now();
    const unique = [];
    const seen = new Set();
    Object.keys(tabContextMap).forEach(k => {
        const hit = tabContextMap[k];
        if (!hit) { delete tabContextMap[k]; return; }
        if (seen.has(hit)) return;
        seen.add(hit);
        if (now - hit._ts > TAB_CONTEXT_TTL) {
            forgetTabContextEntry(hit);
            return;
        }
        unique.push(hit);
    });
    if (unique.length <= TAB_CONTEXT_MAX) return;
    unique.sort((a, b) => a._ts - b._ts);
    unique.slice(0, unique.length - TAB_CONTEXT_MAX).forEach(forgetTabContextEntry);
}

function rememberTabContext(ctx) {
    if (!ctx || !ctx.topLevelMenu) return;
    const entry = {
        topLevelMenu: ctx.topLevelMenu,
        text: ctx.text || ctx.title || '',
        title: ctx.title || ctx.text || '',
        name: ctx.name || '',
        key: ctx.key || '',
        href: ctx.href || '',
        id: ctx.id || '',
        _ts: Date.now(),
        _keys: []
    };
    const newKeys = tabContextIndexKeys(entry);
    // 精确删除将要被覆盖的旧 entry（含同身份 / 同索引冲突）
    const toForget = new Set();
    const prev = lookupTabContext(ctx);
    if (prev) toForget.add(prev);
    newKeys.forEach(k => {
        const hit = tabContextMap[k];
        if (hit) toForget.add(hit);
    });
    toForget.forEach(forgetTabContextEntry);

    entry._keys = newKeys;
    newKeys.forEach(k => {
        tabContextMap[k] = entry;
    });
    pruneTabContextMap();
}

function lookupTabContext(info) {
    if (!info) return null;
    const keys = tabContextIndexKeys({
        id: info.id || '',
        name: info.name || '',
        key: info.key || '',
        href: info.href || ''
    });
    for (let i = 0; i < keys.length; i++) {
        const hit = tabContextMap[keys[i]];
        if (hit && hit.topLevelMenu) return hit;
    }
    return null;
}

function rebindTabContextFromTag(info) {
    if (!info) return;
    let base = lookupTabContext(info);
    if (!base && suspendedMenuHint && info.title && info.title === suspendedMenuHint.title) {
        base = {
            topLevelMenu: suspendedMenuHint.topLevelMenu,
            text: suspendedMenuHint.text,
            title: suspendedMenuHint.title
        };
    }
    if (!base || !base.topLevelMenu) return;
    rememberTabContext({
        topLevelMenu: base.topLevelMenu,
        text: base.text || info.title || '',
        title: info.title || base.title || '',
        name: info.name || base.name || '',
        key: info.key || base.key || '',
        href: info.href || base.href || '',
        id: info.id || base.id || ''
    });
}

function adoptActiveTagKeyIfMatchesHint(info) {
    if (!info || !suspendedMenuHint) return;
    if (info.title && info.title === suspendedMenuHint.title) {
        lastSyncedTagKey = info.key || info.title || lastSyncedTagKey;
        rebindTabContextFromTag(info);
    }
}

function clearTabContextMap() {
    Object.keys(tabContextMap).forEach(k => { delete tabContextMap[k]; });
}

// 恢复原始菜单显示
function restoreOriginalMenu() {
    console.log('ERP Menu Plugin: Restoring original menu...');

    // 先把原顶栏控件移回原位（必须在移除插件顶栏之前）
    restoreHeaderActions();
    
    // 移除自定义布局元素
    const topMenuContainer = document.querySelector('.custom-top-menu-container');
    const subMenuContainer = document.querySelector('.custom-sub-menu-container');
    if (topMenuContainer) topMenuContainer.remove();
    if (subMenuContainer) subMenuContainer.remove();
    
    // 恢复原始侧边栏显示
    const sideParams = document.querySelector('.side-menu-wrapper');
    const originalSidebar = document.querySelector('.sider-memutree-conainter');
    if (sideParams) sideParams.style.display = '';
    if (originalSidebar) originalSidebar.style.display = '';
    
    // 移除body类
    document.body.classList.remove('custom-layout-active');

    lastSyncedTagKey = null;
    pendingSyncInfo = null;
    resumeAutoTagSync();
    clearTabContextMap();
    if (tagNavObserver) {
        tagNavObserver.disconnect();
        tagNavObserver = null;
    }
    if (tagNavSyncTimer) {
        clearTimeout(tagNavSyncTimer);
        tagNavSyncTimer = null;
    }
    if (tagNavPollTimer) {
        clearInterval(tagNavPollTimer);
        tagNavPollTimer = null;
    }
    tagNavObservedRoot = null;
    
    console.log('ERP Menu Plugin: Original menu restored.');
}

// 定位和修改 DOM 的主要逻辑
function applyCustomLayout() {
    // 检查是否启用
    if (!isMenuModificationEnabled) {
        console.log('ERP Menu Plugin: Menu modification is disabled.');
        restoreOriginalMenu();
        return;
    }
    
    console.log('ERP Menu Plugin: Starting layout transformation...');

    // 1. 查找原始菜单容器
    // 优先查找更外层的 wrapper，以便彻底隐藏旧菜单区域
    const sideParams = document.querySelector('.side-menu-wrapper');
    const originalSidebar = document.querySelector('.sider-memutree-conainter');
    
    // 如果两个都没找到，说明还没加载好
    if (!sideParams && !originalSidebar) {
        console.log('ERP Menu Plugin: Original sidebar not found yet.');
        return;
    }

    // 防止重复执行
    if (document.querySelector('.custom-top-menu-container')) {
        console.log('ERP Menu Plugin: Transformation already applied.');
        return;
    }

    // 2. 找到根菜单列表 (ivu-menu)
    // 放宽选择器，只要是侧边栏里的 ivu-menu 即可
    const menuRoot = originalSidebar || sideParams;
    const rootMenuConfig = menuRoot.querySelector('.ivu-menu');
    
    if (!rootMenuConfig) {
        console.error('ERP Menu Plugin: Root .ivu-menu not found inside sidebar.');
        return;
    }

    // 获取所有的第一级菜单项 (li)
    const topLevelItems = Array.from(rootMenuConfig.children).filter(node => node.tagName === 'LI');
    console.log(`ERP Menu Plugin: Found ${topLevelItems.length} top-level menu items.`);

    if (topLevelItems.length === 0) {
        console.warn('ERP Menu Plugin: No top-level items found, aborting.');
        return;
    }

    // 3. 创建顶栏容器 (Top Bar)
    const topMenuContainer = document.createElement('div');
    topMenuContainer.className = 'custom-top-menu-container';

    // --- 新增：处理 LOGO ---
    // 从 side-menu-wrapper 中查找 logo
    const logoSource = document.querySelector('.side-menu-wrapper .logo-con') || document.querySelector('.logo-con');
    if (logoSource) {
        const logoClone = logoSource.cloneNode(true);
        logoClone.className = 'custom-top-logo'; // 重置类名以便样式控制
        
        // 处理图片显示：显示大图，隐藏小图，限制高度
        const imgs = logoClone.querySelectorAll('img');
        imgs.forEach(img => {
            // 简单判断：通常第一个是正常 logo，或者根据 src 判断
            if (img.src.includes('min')) {
                img.style.display = 'none';
            } else {
                img.style.display = 'block';
                img.style.height = '30px'; // 顶栏高度50px，logo 30px 比较合适
                img.style.width = 'auto';
            }
        });
        
        topMenuContainer.appendChild(logoClone);
    }
    // -----------------------

    // 4. 创建左侧子菜单容器 (Sidebar for sub-items)
    const subMenuContainer = document.createElement('div');
    subMenuContainer.className = 'custom-sub-menu-container';
    
    // 插入到页面中
    document.body.prepend(topMenuContainer);
    document.body.appendChild(subMenuContainer);

    // 5. 隐藏原始侧边栏
    // 隐藏最外层的 wrapper，这样可以把 Logo 等也隐藏掉，腾出空间
    if (sideParams) sideParams.style.display = 'none';
    if (originalSidebar) originalSidebar.style.display = 'none';
    
    document.body.classList.add('custom-layout-active');

    // 6. 遍历第一级菜单，构建顶栏 tabs
    topLevelItems.forEach((li, index) => {
        // 获取标题区域
        const titleDiv = li.querySelector('.ivu-menu-submenu-title') || li;
        
        // 提取图标和文字
        let iconHTML = '';
        let text = '';
        const iconNode = titleDiv.querySelector('i');
        const spanNode = titleDiv.querySelector('span');

        if (iconNode) iconHTML = iconNode.outerHTML;
        if (spanNode) text = spanNode.innerText;
        if (!text) text = titleDiv.innerText.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim();

        // 提取该顶级菜单下的 子菜单 ul
        const subMenuUl = li.querySelector('ul.ivu-menu');

        console.log(`ERP Menu Plugin: Processing item ${index}: ${text}`);

        // 创建顶栏元素
        const topMenuItem = document.createElement('div');
        topMenuItem.className = 'custom-top-menu-item';
        topMenuItem.innerHTML = `${iconHTML}<span>${text}</span>`;
        // 添加 title 属性以便鼠标悬停查看
        topMenuItem.title = text;
        
        // 点击事件
        topMenuItem.addEventListener('click', () => {
            console.log(`ERP Menu Plugin: Clicked top menu ${text}`);
            
            // 记录当前激活的顶级菜单名称
            currentTopLevelMenuName = text;
            
            // 样式激活状态切换
            document.querySelectorAll('.custom-top-menu-item').forEach(el => el.classList.remove('active'));
            topMenuItem.classList.add('active');

            // 清空并重新填充子菜单区域
            subMenuContainer.innerHTML = '';
            
            if (subMenuUl) {
                // 克隆一份子菜单 DOM
                const clonedUl = subMenuUl.cloneNode(true);
                clonedUl.style.display = 'block'; // 确保显示
                clonedUl.style.width = '100%';
                
                initSubMenuInteractions(clonedUl, text);
                subMenuContainer.appendChild(clonedUl);
            } else {
                subMenuContainer.innerHTML = '<div class="no-submenu-tip">无子菜单</div>';
                // 如果是叶子节点，触发点击
                // li.click(); // 可选：视业务逻辑是否需要点击这里就跳转
            }
        });

        topMenuContainer.appendChild(topMenuItem);
    });

    // 加载收藏列表并添加收藏菜单（浮层，不占用左侧子菜单）
    loadFavorites(() => {
        addFavoritesTab(topMenuContainer);
    });

    // 添加搜索功能
    addSearchBox(topMenuContainer, subMenuContainer, rootMenuConfig);

    // 将原页面右上角按钮/下拉迁入插件顶栏，并隐藏原 header 行
    relocateHeaderActions(topMenuContainer);

    // 按当前内容区 tab 同步左侧模块；没有 tab 时才默认第一个模块
    setTimeout(() => {
        if (!syncLeftMenuToActiveTab()) {
            const first = topMenuContainer.querySelector('.custom-top-menu-item:not(.favorites-tab):not(.custom-more-menu)');
            if (first) first.click();
        }
        initTagNavSync();
    }, 120);

    // 添加横向菜单折叠功能（可选）- 延迟执行确保DOM渲染完成
    // 使用双重延迟确保所有元素都已渲染
    setTimeout(() => {
        initHorizontalMenuCollapse(topMenuContainer);
        // 再次延迟执行一次，确保布局稳定
        setTimeout(() => {
            const collapseFunc = topMenuContainer.__collapseFunc;
            if (collapseFunc) {
                collapseFunc();
            }
        }, 100);
    }, 300);

    console.log('ERP Menu Plugin: Layout transformation applied successfully.');
}

// 将原 header 右上角控件迁移到插件顶栏（移动真实 DOM，保留 Vue/iView 事件）
function relocateHeaderActions(topMenuContainer) {
    const customContent = document.querySelector('.custom-content-con');
    const headerCon = document.querySelector('.header-con');
    if (!customContent) {
        console.log('ERP Menu Plugin: .custom-content-con not found, skip header relocate.');
        return;
    }

    // 已迁移则只更新位置
    let wrapper = topMenuContainer.querySelector('.custom-header-actions');
    if (!wrapper) {
        if (!customContent.__erpPluginOriginalParent) {
            customContent.__erpPluginOriginalParent = customContent.parentElement;
            customContent.__erpPluginNextSibling = customContent.nextSibling;
        }

        wrapper = document.createElement('div');
        wrapper.className = 'custom-header-actions';
        wrapper.appendChild(customContent);
    }

    applyHeaderActionsPosition(topMenuContainer, wrapper);

    if (headerCon) {
        headerCon.classList.add('erp-plugin-hidden-header');
        headerCon.style.display = 'none';
        headerCon.style.height = '0';
        headerCon.style.minHeight = '0';
        headerCon.style.padding = '0';
        headerCon.style.overflow = 'hidden';
    }

    console.log('ERP Menu Plugin: Header actions relocated to plugin top bar.');
}

// 按配置把操作区放到顶栏左侧或右侧
function applyHeaderActionsPosition(topMenuContainer, wrapper) {
    if (!topMenuContainer || !wrapper) return;

    wrapper.classList.remove('position-left', 'position-right');
    wrapper.classList.add(headerActionsPosition === 'left' ? 'position-left' : 'position-right');

    if (headerActionsPosition === 'left') {
        const searchContainer = topMenuContainer.querySelector('.menu-search-container');
        const logo = topMenuContainer.querySelector('.custom-top-logo');
        const insertAfter = searchContainer || logo;
        if (insertAfter && insertAfter.nextSibling) {
            topMenuContainer.insertBefore(wrapper, insertAfter.nextSibling);
        } else if (insertAfter) {
            topMenuContainer.appendChild(wrapper);
        } else {
            topMenuContainer.insertBefore(wrapper, topMenuContainer.firstChild);
        }
    } else {
        topMenuContainer.appendChild(wrapper);
    }
}

// 还原原顶栏控件
function restoreHeaderActions() {
    const customContent = document.querySelector('.custom-content-con');
    const headerCon = document.querySelector('.header-con') || document.querySelector('.erp-plugin-hidden-header');
    const wrapper = document.querySelector('.custom-header-actions');

    if (customContent && customContent.__erpPluginOriginalParent) {
        const parent = customContent.__erpPluginOriginalParent;
        const next = customContent.__erpPluginNextSibling;
        if (next && next.parentElement === parent) {
            parent.insertBefore(customContent, next);
        } else {
            parent.appendChild(customContent);
        }
        delete customContent.__erpPluginOriginalParent;
        delete customContent.__erpPluginNextSibling;
    }

    if (wrapper) {
        wrapper.remove();
    }

    if (headerCon) {
        headerCon.classList.remove('erp-plugin-hidden-header');
        headerCon.style.display = '';
        headerCon.style.height = '';
        headerCon.style.minHeight = '';
        headerCon.style.padding = '';
        headerCon.style.overflow = '';
    }
}

function normalizeMenuText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
}

function getTopLevelTitleFromLi(topLi) {
    const topTitleEl = topLi.querySelector(':scope > .ivu-menu-submenu-title, :scope > div.ivu-menu-submenu-title');
    const el = topTitleEl || topLi.querySelector('.ivu-menu-submenu-title');
    if (!el) return '';
    const span = el.querySelector('span');
    return normalizeMenuText(span ? span.innerText : el.innerText);
}

function getTagRouteItem(tag) {
    if (!tag) return null;
    try {
        let node = tag;
        for (let d = 0; d < 6 && node; d++) {
            const vue = node.__vue__;
            if (vue) {
                const item = (vue.$attrs && (vue.$attrs['data-route-item'] || vue.$attrs.item))
                    || vue.item
                    || vue.routeItem
                    || (vue.$props && (vue.$props['data-route-item'] || vue.$props.item));
                if (item && typeof item === 'object') return item;
            }
            node = node.parentElement;
        }
    } catch (e) {}
    return null;
}

function pickRouteHref(item) {
    if (!item || typeof item !== 'object') return '';
    const raw = item.href || item.path || item.url || '';
    return raw ? String(raw) : '';
}

function parseTagEl(tag) {
    if (!tag) return null;
    const textEl = tag.querySelector('.ivu-tag-text');
    let title = normalizeMenuText(textEl ? textEl.innerText : tag.innerText);
    let name = tag.id ? tag.id.replace(/^tag-nav-/, '') : '';
    let href = '';
    try {
        const item = getTagRouteItem(tag);
        if (item) {
            if (item.title) title = normalizeMenuText(item.title);
            if (item.name) name = item.name;
            if (item.key && item.key !== item.name) name = name || item.key;
            href = pickRouteHref(item);
        }
    } catch (e) {}
    const key = tag.id || name || title;
    if (!title && !key) return null;
    return { title, name, href, id: tag.id || '', key };
}

function getActiveTagInfo() {
    const tag = document.querySelector('.tags-nav .ivu-tag-checked')
        || document.querySelector('.tags-nav .ivu-tag-primary');
    return parseTagEl(tag);
}

// 根据 tab 标题在原始菜单中找对应模块和叶子项
function findMenuMatchForTitle(title) {
    if (!title) return null;
    const originalSidebar = document.querySelector('.sider-memutree-conainter');
    if (!originalSidebar) return null;
    const rootMenu = originalSidebar.querySelector('.ivu-menu');
    if (!rootMenu) return null;

    const topLevelItems = Array.from(rootMenu.children).filter(node => node.tagName === 'LI');
    const candidates = [];

    const push = (score, payload) => {
        candidates.push(Object.assign({ score }, payload));
    };

    topLevelItems.forEach(topLi => {
        const topTitle = getTopLevelTitleFromLi(topLi);
        topLi.querySelectorAll('.ivu-menu-item').forEach(item => {
            const itemText = normalizeMenuText(item.innerText);
            if (!itemText) return;
            if (itemText === title) {
                push(100, { text: itemText, topLevelMenu: topTitle });
            } else if (itemText.length >= 2 && (title.includes(itemText) || itemText.includes(title))) {
                push(70 + Math.min(itemText.length, 20), { text: itemText, topLevelMenu: topTitle });
            }
        });
        topLi.querySelectorAll('.ivu-menu-submenu-title').forEach(subTitle => {
            const subText = normalizeMenuText(subTitle.querySelector('span')?.innerText || subTitle.innerText);
            if (!subText || subText === topTitle) return;
            if (subText === title) {
                push(90, { text: subText, topLevelMenu: topTitle, isGroup: true });
            }
        });
        if (topTitle && (title === topTitle || title.startsWith(topTitle))) {
            push(50 + Math.min(topTitle.length, 20), { text: null, topLevelMenu: topTitle });
        }
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    const topScore = candidates[0].score;
    const topHits = candidates.filter(c => c.score === topScore);
    if (topHits.length > 1 && topScore >= 100) {
        return null;
    }
    if (topScore < 100) {
        const preferCurrent = candidates.find(c => c.topLevelMenu === currentTopLevelMenuName && c.score === topScore);
        return preferCurrent || candidates[0];
    }
    return candidates[0];
}

// 展开左侧菜单中目标项的祖先，并高亮该项
function highlightLeftMenuItem(text) {
    const container = document.querySelector('.custom-sub-menu-container');
    if (!container || !text) return;

    const items = container.querySelectorAll('.ivu-menu-item');
    let target = null;
    for (const item of items) {
        if (getMenuItemText(item) === text) {
            target = item;
            break;
        }
    }

    container.querySelectorAll('.ivu-menu-item').forEach(i => {
        i.classList.remove('ivu-menu-item-active', 'ivu-menu-item-selected');
    });

    if (target) {
        target.classList.add('ivu-menu-item-active', 'ivu-menu-item-selected');
        expandAncestors(target, container);
        if (typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ block: 'nearest' });
        }
        return;
    }

    const titles = container.querySelectorAll('.ivu-menu-submenu-title');
    for (const title of titles) {
        const titleText = normalizeMenuText(title.querySelector('span')?.innerText || title.innerText);
        if (titleText === text) {
            const nextUl = title.nextElementSibling;
            if (nextUl && nextUl.tagName === 'UL') {
                nextUl.classList.remove('erp-submenu-collapsed');
                nextUl.style.display = 'block';
                const arrow = title.querySelector('.ivu-icon-ios-arrow-down');
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            }
            expandAncestors(title, container);
            if (typeof title.scrollIntoView === 'function') {
                title.scrollIntoView({ block: 'nearest' });
            }
            break;
        }
    }
}

function expandAncestors(startEl, container) {
    let el = startEl.parentElement;
    while (el && el !== container) {
        if (el.tagName === 'UL') {
            el.classList.remove('erp-submenu-collapsed');
            el.style.display = 'block';
            const title = el.previousElementSibling;
            if (title && title.classList.contains('ivu-menu-submenu-title')) {
                const arrow = title.querySelector('.ivu-icon-ios-arrow-down');
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            }
        }
        el = el.parentElement;
    }
}

function activateTopLevelMenu(topLevelMenuName) {
    if (!topLevelMenuName) return false;
    const topMenuContainer = document.querySelector('.custom-top-menu-container');
    if (!topMenuContainer) return false;
    const topItems = topMenuContainer.querySelectorAll('.custom-top-menu-item:not(.favorites-tab):not(.custom-more-menu)');
    for (const item of topItems) {
        const spans = item.querySelectorAll('span');
        const topText = Array.from(spans).map(s => s.innerText.trim()).filter(Boolean).pop() || '';
        if (topText === topLevelMenuName) {
            if (!item.classList.contains('active')) {
                item.click();
            }
            return true;
        }
    }
    return false;
}

function syncLeftMenuFromMenuItem(topLevelMenu, itemText) {
    if (!topLevelMenu) return false;
    // 已知正确模块：挂起自动同步，防止随后 tab 观察/轮询按歧义标题切错
    suspendAutoTagSync(topLevelMenu, itemText);
    rememberTabContext({
        topLevelMenu,
        text: itemText || topLevelMenu,
        title: itemText || topLevelMenu
    });
    setPendingSyncInfo({
        title: itemText || topLevelMenu,
        name: '',
        id: '',
        key: itemText || topLevelMenu
    });
    lastSyncedTagKey = pendingSyncInfo.key;
    activateTopLevelMenu(topLevelMenu);
    if (itemText) {
        setTimeout(() => highlightLeftMenuItem(itemText), 40);
    }
    return true;
}

// 按当前内容 tab 同步左侧：优先 tabContextMap，其次唯一路由；否则不切模块
function syncLeftMenuToActiveTab(forcedInfo) {
    if (!isMenuModificationEnabled) return false;
    if (!document.querySelector('.custom-top-menu-container')) return false;

    const info = forcedInfo || pendingSyncInfo || getActiveTagInfo();
    if (!info || !info.title) return false;

    lastSyncedTagKey = info.key || info.title;

    const cached = lookupTabContext(info);
    if (cached && cached.topLevelMenu) {
        rebindTabContextFromTag(info);
        activateTopLevelMenu(cached.topLevelMenu);
        if (cached.text) {
            setTimeout(() => highlightLeftMenuItem(cached.text), 40);
        }
        return true;
    }

    const routeMatch = findMenuMatchForTag(info);
    if (routeMatch && routeMatch.topLevelMenu) {
        rememberTabContext({
            topLevelMenu: routeMatch.topLevelMenu,
            text: routeMatch.text || info.title,
            title: info.title,
            name: info.name || '',
            key: info.key || '',
            href: info.href || '',
            id: info.id || ''
        });
        activateTopLevelMenu(routeMatch.topLevelMenu);
        if (routeMatch.text) {
            setTimeout(() => highlightLeftMenuItem(routeMatch.text), 40);
        }
        return true;
    }

    // 无缓存、无唯一路由：绝不按标题切模块，仅在当前模块里尝试高亮
    if (info.title) {
        setTimeout(() => highlightLeftMenuItem(info.title), 40);
    }

    const payload = {
        title: info.title,
        name: info.name,
        href: info.href,
        key: info.key,
        id: info.id,
        currentModule: currentTopLevelMenuName
    };
    if (!info.href) {
        const activeTag = document.querySelector('.tags-nav .ivu-tag-checked')
            || document.querySelector('.tags-nav .ivu-tag-primary');
        const rawItem = getTagRouteItem(activeTag);
        payload.routeItemKeys = rawItem ? Object.keys(rawItem) : null;
        payload.routeItemSample = rawItem
            ? {
                href: rawItem.href,
                path: rawItem.path,
                url: rawItem.url,
                name: rawItem.name,
                key: rawItem.key,
                title: rawItem.title
            }
            : null;
    }
    console.warn('ERP Menu Plugin: Tab reverse sync skipped module switch (no context/route)', payload);
    return false;
}

function resolveTagInfoForSync() {
    const active = getActiveTagInfo();
    if (!pendingSyncInfo) return active;
    if (active) {
        const sameKey = active.key && active.key === pendingSyncInfo.key;
        const sameTitle = active.title && active.title === pendingSyncInfo.title;
        if (sameKey || sameTitle) {
            // 收藏/搜索等已按菜单项同步过左侧；tab 出现后只对齐 key，避免再按路由/标题重匹配切错模块
            lastSyncedTagKey = active.key || active.title || lastSyncedTagKey;
            rebindTabContextFromTag(active);
            pendingSyncInfo = null;
            return null;
        }
    }
    if (Date.now() - pendingSyncInfo._ts > PENDING_SYNC_TTL) {
        // TTL 到期且标题仍一致：同样只对齐 key，不触发重匹配
        if (active && pendingSyncInfo.title && active.title === pendingSyncInfo.title) {
            lastSyncedTagKey = active.key || active.title || lastSyncedTagKey;
            rebindTabContextFromTag(active);
            pendingSyncInfo = null;
            return null;
        }
        pendingSyncInfo = null;
        return active;
    }
    return pendingSyncInfo;
}

function scheduleTagNavSync(forcedInfo) {
    if (forcedInfo) {
        setPendingSyncInfo(forcedInfo);
    }
    if (tagNavSyncTimer) clearTimeout(tagNavSyncTimer);
    tagNavSyncTimer = setTimeout(() => {
        if (autoTagSyncSuspended) {
            adoptActiveTagKeyIfMatchesHint(getActiveTagInfo());
            return;
        }
        const info = resolveTagInfoForSync();
        if (!info) return;
        if (info.key && info.key === lastSyncedTagKey) return;
        syncLeftMenuToActiveTab(info);
    }, 0);
}

function onTagNavClick(e) {
    if (!isMenuModificationEnabled) return;
    const tag = e.target && e.target.closest && e.target.closest('.tags-nav .ivu-tag');
    if (!tag) return;
    if (e.target.closest('.ivu-icon-ios-close, .ivu-icon-ios-close-circle, .ivu-icon-ios-close-circle-outline')) {
        return;
    }
    // 仅用户真实点击才恢复自动同步；程序触发的 tag.click() 不解除挂起
    if (e.isTrusted) {
        resumeAutoTagSync();
    } else if (autoTagSyncSuspended) {
        return;
    }
    const info = parseTagEl(tag);
    if (!info) return;
    setPendingSyncInfo(info);
    syncLeftMenuToActiveTab(info);
}

function initTagNavSync() {
    const root = document.querySelector('.tag-nav-wrapper')
        || document.querySelector('.tags-nav')
        || document.querySelector('.main-content-con');

    if (tagNavObserver && tagNavObservedRoot && document.contains(tagNavObservedRoot) && tagNavObservedRoot === root) {
        return;
    }

    if (tagNavObserver) {
        tagNavObserver.disconnect();
        tagNavObserver = null;
    }

    if (root) {
        tagNavObservedRoot = root;
        tagNavObserver = new MutationObserver(() => scheduleTagNavSync());
        tagNavObserver.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    document.removeEventListener('click', onTagNavClick, true);
    document.addEventListener('click', onTagNavClick, true);

    if (!tagNavPollTimer) {
        tagNavPollTimer = setInterval(() => {
            if (!isMenuModificationEnabled) return;
            if (!document.querySelector('.custom-top-menu-container')) return;
            if (autoTagSyncSuspended) {
                adoptActiveTagKeyIfMatchesHint(getActiveTagInfo());
                return;
            }
            const info = resolveTagInfoForSync();
            if (info && info.key && info.key !== lastSyncedTagKey) {
                syncLeftMenuToActiveTab(info);
            }
        }, 400);
    }
}

// 辅助函数：处理子菜单的折叠展开逻辑
// 因为直接克隆了 DOM，原有的 Vue/iView 事件绑定失效了，需要手动实现简单的折叠效果
function initSubMenuInteractions(rootElement, topLevelMenuName = null) {
    // 找到所有的 子菜单标题 (ivu-menu-submenu-title)
    const titles = rootElement.querySelectorAll('.ivu-menu-submenu-title');
    let expandedFirst = false;
    
    titles.forEach(title => {
        // 对应的下一个兄弟元素应该是 ul
        const nextUl = title.nextElementSibling;
        
        // 不再硬编码paddingLeft，让CSS根据层级自动处理缩进
        // 移除可能存在的内联样式覆盖，让CSS规则生效
        if (title.style.paddingLeft) {
            title.style.paddingLeft = '';
        }
        
        if (nextUl && nextUl.tagName === 'UL') {
            title.style.cursor = 'pointer';
            
            // 默认只展开第一个可折叠子菜单，其余收起
            const arrow = title.querySelector('.ivu-icon-ios-arrow-down');
            const shouldExpand = !expandedFirst;
            if (shouldExpand) {
                expandedFirst = true;
                nextUl.style.display = 'block';
                nextUl.classList.remove('erp-submenu-collapsed');
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            } else {
                nextUl.style.display = 'none';
                nextUl.classList.add('erp-submenu-collapsed');
                if (arrow) arrow.style.transform = 'rotate(-90deg)';
            }
            
            // 绑定点击事件：只折叠/展开子菜单，不影响其他菜单项
            title.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const isCollapsed = nextUl.classList.contains('erp-submenu-collapsed');
                
                if (isCollapsed) {
                    nextUl.classList.remove('erp-submenu-collapsed');
                    nextUl.style.display = 'block';
                    if (arrow) arrow.style.transform = 'rotate(0deg)';
                } else {
                    nextUl.classList.add('erp-submenu-collapsed');
                    nextUl.style.display = 'none';
                    if (arrow) arrow.style.transform = 'rotate(-90deg)';
                }
            });
        }
    });
    
    // 处理叶子节点的点击 (ivu-menu-item)
    // 点击后需要高亮，并在此处可能需要触发真正的页面跳转
    // 由于是单页应用或框架，点击原 DOM 可能触发路由。
    // 我们克隆的节点没有原事件。
    // 策略：点击克隆节点 -> 找到对应的原节点 -> 模拟点击
    const items = rootElement.querySelectorAll('.ivu-menu-item');
    items.forEach(item => {
        // 添加收藏按钮（传递顶级菜单名称）
        addFavoriteButton(item, topLevelMenuName);
        
        item.addEventListener('click', (e) => {
            // 如果点击的是收藏按钮，不触发菜单项点击
            if (e.target.closest('.favorite-btn')) {
                return;
            }
            
            // 阻止事件冒泡，避免触发父级菜单的折叠
            e.stopPropagation();
            e.preventDefault();
            
             // 视觉高亮
             rootElement.querySelectorAll('.ivu-menu-item').forEach(i => i.classList.remove('ivu-menu-item-active', 'ivu-menu-item-selected'));
             item.classList.add('ivu-menu-item-active', 'ivu-menu-item-selected');
             
             // 获取菜单项的完整路径和文本（排除收藏按钮）
             const itemText = getMenuItemText(item);
             const itemPath = getMenuItemFullPath(item);
             
             // 使用顶级菜单名称+路径+文本进行精确匹配
             const topMenu = topLevelMenuName || currentTopLevelMenuName;
             if (topMenu) suspendAutoTagSync(topMenu, itemText);
             triggerOriginalClick(itemText, itemPath, topMenu);
             if (topMenu) syncLeftMenuFromMenuItem(topMenu, itemText);
        });
    });
}

// 获取菜单项的真实文本（排除收藏按钮）
function getMenuItemText(menuItem) {
    // 克隆节点以避免修改原始DOM
    const clone = menuItem.cloneNode(true);
    // 移除收藏按钮
    const favoriteBtn = clone.querySelector('.favorite-btn');
    if (favoriteBtn) {
        favoriteBtn.remove();
    }
    // 获取文本内容
    return clone.innerText.trim();
}

// 获取菜单项的完整路径（从顶级菜单到当前项）
function getMenuItemFullPath(menuItem) {
    const path = [];
    let current = menuItem;
    
    // 向上查找所有父级菜单标题，直到找到顶级菜单
    while (current && current !== document.body) {
        // 查找父级的 submenu-title
        const parentSubmenu = current.closest('.ivu-menu-submenu');
        if (parentSubmenu) {
            const title = parentSubmenu.querySelector('.ivu-menu-submenu-title');
            if (title) {
                const titleText = title.innerText.trim();
                if (titleText) {
                    path.unshift(titleText);
                }
            }
            current = parentSubmenu.parentElement;
        } else {
            // 查找是否在顶级菜单下（查找最近的顶级菜单项）
            const topLevelItem = current.closest('li');
            if (topLevelItem) {
                const topTitle = topLevelItem.querySelector('.ivu-menu-submenu-title');
                if (topTitle) {
                    const topText = topTitle.innerText.trim();
                    if (topText && !path.includes(topText)) {
                        path.unshift(topText);
                    }
                }
            }
            break;
        }
    }
    
    return path;
}

// 获取原始菜单项所在的顶级菜单名称
function getTopLevelMenuName(menuItem) {
    // 向上查找，找到顶级菜单项
    let current = menuItem;
    while (current && current !== document.body) {
        const parentLi = current.closest('li');
        if (parentLi) {
            const parentUl = parentLi.parentElement;
            // 检查是否是顶级菜单（直接子元素是 .ivu-menu）
            if (parentUl && parentUl.classList.contains('ivu-menu')) {
                const topLevelLi = parentUl.parentElement;
                if (topLevelLi && topLevelLi.tagName === 'LI') {
                    const topTitle = topLevelLi.querySelector('.ivu-menu-submenu-title');
                    if (topTitle) {
                        return topTitle.innerText.trim();
                    }
                }
            }
            current = parentLi.parentElement;
        } else {
            break;
        }
    }
    return null;
}

function stripTopFromPath(path, topLevelMenuName) {
    const list = (path || []).map(normalizeMenuText).filter(Boolean);
    if (topLevelMenuName && list.length > 0 && list[0] === topLevelMenuName) {
        return list.slice(1);
    }
    return list;
}

function pathsEqual(a, b, topLevelMenuName) {
    const x = stripTopFromPath(a, topLevelMenuName);
    const y = stripTopFromPath(b, topLevelMenuName);
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) {
        if (x[i] !== y[i]) return false;
    }
    return true;
}

function getOriginalTopLevelItems() {
    const originalSidebar = document.querySelector('.sider-memutree-conainter');
    if (!originalSidebar) return [];
    const rootMenu = originalSidebar.querySelector('.ivu-menu');
    if (!rootMenu) return [];
    return Array.from(rootMenu.children).filter(node => node.tagName === 'LI');
}

function findOriginalMenuItem(text, path = [], topLevelMenuName = null) {
    const topLevelItems = getOriginalTopLevelItems();
    if (topLevelItems.length === 0) return null;

    let scoped = topLevelItems;
    if (topLevelMenuName) {
        scoped = topLevelItems.filter(topLi => getTopLevelTitleFromLi(topLi) === topLevelMenuName);
        if (scoped.length === 0) scoped = topLevelItems;
    }

    const items = [];
    scoped.forEach(topLi => {
        topLi.querySelectorAll('.ivu-menu-item').forEach(item => items.push({ item, topLi }));
    });

    const exact = items.filter(({ item }) => normalizeMenuText(item.innerText) === text);
    if (exact.length === 0) return null;

    if (path && path.length > 0) {
        const pathHit = exact.find(({ item }) => {
            return pathsEqual(getMenuItemFullPath(item), path, topLevelMenuName);
        });
        if (pathHit) return pathHit.item;
    }

    if (topLevelMenuName && exact.length === 1) return exact[0].item;
    if (exact.length === 1) return exact[0].item;
    return null;
}

function isLikelyRouteId(value) {
    if (value === undefined || value === null) return false;
    const s = String(value).trim();
    if (!s) return false;
    const skip = /^(menu|imenuitem|menuitem|submenu|imenusubmenu|submenuitem|i-menu|i-menu-item|i-submenu)$/i;
    return !skip.test(s);
}

function getMenuItemRouteInfo(el) {
    if (!el) return null;
    const info = { name: '', key: '', href: '', title: '' };
    const take = (slot, v) => {
        if (!isLikelyRouteId(v)) return;
        const s = String(v);
        if (!info[slot]) info[slot] = s;
    };
    const takeName = (v) => take('name', v);
    const takeKey = (v) => take('key', v);
    const takeHref = (v) => {
        if (v && typeof v === 'string' && !info.href) info.href = v;
    };
    try {
        let node = el;
        for (let d = 0; d < 6 && node; d++) {
            const vue = node.__vue__;
            if (vue) {
                if (vue.$props) {
                    takeName(vue.$props.name);
                    takeHref(vue.$props.href || vue.$props.url);
                }
                if (vue.$options && vue.$options.propsData) {
                    takeName(vue.$options.propsData.name);
                }
                const item = vue.item
                    || (vue.$attrs && (vue.$attrs.item || vue.$attrs['data-route-item']))
                    || vue.menuItem;
                if (item && typeof item === 'object') {
                    takeName(item.name);
                    takeKey(item.key);
                    takeHref(item.href || item.path || item.url);
                    if (item.title && !info.title) info.title = String(item.title);
                }
                const to = vue.to || (vue.$props && vue.$props.to);
                if (to) {
                    if (typeof to === 'string') takeHref(to);
                    else {
                        takeHref(to.path || to.href);
                        takeName(to.name);
                    }
                }
            }
            node = node.parentElement;
        }
    } catch (e) {}
    if (!info.name && !info.key && !info.href) return null;
    return info;
}

function getTagRouteHref(tag) {
    return pickRouteHref(getTagRouteItem(tag));
}

function hrefLooseEqual(a, b) {
    if (!a || !b) return false;
    const na = String(a).replace(/^\.\//, '').replace(/^\//, '').replace(/\/+$/, '');
    const nb = String(b).replace(/^\.\//, '').replace(/^\//, '').replace(/\/+$/, '');
    if (na === nb) return true;
    const segA = na.split('/').filter(Boolean);
    const segB = nb.split('/').filter(Boolean);
    if (segA.length === segB.length || segA.length === 0 || segB.length === 0) return false;
    const longer = segA.length > segB.length ? segA : segB;
    const shorter = segA.length > segB.length ? segB : segA;
    if (shorter.length < 2) return false;
    return longer.slice(longer.length - shorter.length).join('/') === shorter.join('/');
}

function findOriginalMenuItemByRoute(route) {
    if (!route || (!route.name && !route.href && !route.key)) return null;
    const names = Array.from(new Set([route.name, route.key].filter(isLikelyRouteId).map(String)));
    const topLevelItems = getOriginalTopLevelItems();
    let bestScore = 0;
    let bestCount = 0;
    let best = null;
    topLevelItems.forEach(topLi => {
        const topTitle = getTopLevelTitleFromLi(topLi);
        topLi.querySelectorAll('.ivu-menu-item').forEach(item => {
            const r = getMenuItemRouteInfo(item);
            if (!r) return;
            let score = 0;
            names.forEach(n => {
                if (r.name === n || r.key === n) score += 100;
            });
            if (hrefLooseEqual(route.href, r.href)) score += 90;
            if (score > bestScore) {
                bestScore = score;
                bestCount = 1;
                best = {
                    text: normalizeMenuText(item.innerText),
                    topLevelMenu: topTitle
                };
            } else if (score === bestScore && bestScore > 0) {
                bestCount++;
            }
        });
    });
    if (bestScore < 90 || bestCount > 1) return null;
    return best;
}

function findMenuMatchForTag(info) {
    if (!info) return null;
    // 反向同步只认唯一路由；标题匹配不再用于切模块
    return findOriginalMenuItemByRoute({
        name: info.name || '',
        key: info.id ? info.id.replace(/^tag-nav-/, '') : '',
        href: info.href || ''
    });
}

function activateExistingTagByRoute(route, title) {
    const tags = Array.from(document.querySelectorAll('.tags-nav .ivu-tag'));
    if (tags.length === 0) return false;

    let best = null;
    let bestScore = 0;
    tags.forEach(tag => {
        const info = parseTagEl(tag);
        if (!info) return;
        let score = 0;
        if (route) {
            if (route.name && (info.name === route.name || info.id === 'tag-nav-' + route.name)) score += 100;
            if (route.key && (info.name === route.key || info.id === 'tag-nav-' + route.key)) score += 100;
            const tagHref = getTagRouteHref(tag);
            if (hrefLooseEqual(route.href, tagHref)) score += 90;
        }
        if (title && info.title === title) score += 5;
        if (score > bestScore) {
            bestScore = score;
            best = tag;
        }
    });

    if (!best || bestScore < 90) return false;
    best.click();
    const info = parseTagEl(best);
    if (info) {
        setPendingSyncInfo(info);
        lastSyncedTagKey = info.key;
    }
    return true;
}

function openFavorite(fav) {
    const topMenu = fav.path && fav.path.length > 0 ? fav.path[0] : null;
    const subPath = fav.path && fav.path.length > 1 ? fav.path.slice(1) : [];
    // 先挂起自动同步，再打开（避免 tag.click 抢先按歧义标题切错左侧）
    if (topMenu) {
        suspendAutoTagSync(topMenu, fav.text);
        rememberTabContext({
            topLevelMenu: topMenu,
            text: fav.text,
            title: fav.text,
            name: fav.routeName || '',
            key: fav.routeKey || '',
            href: fav.routeHref || ''
        });
    }
    triggerOriginalClick(fav.text, subPath, topMenu);
    if (topMenu) syncLeftMenuFromMenuItem(topMenu, fav.text);
}

function triggerOriginalClick(text, path = [], topLevelMenuName = null) {
    const item = findOriginalMenuItem(text, path, topLevelMenuName);
    if (!item) {
        console.warn('ERP Menu Plugin: Could not find menu item:', text, 'with path:', path, 'in top menu:', topLevelMenuName);
        return;
    }
    const route = getMenuItemRouteInfo(item) || {};
    const topMenu = topLevelMenuName || currentTopLevelMenuName || '';
    if (topMenu) {
        rememberTabContext({
            topLevelMenu: topMenu,
            text,
            title: text,
            name: route.name || '',
            key: route.key || '',
            href: route.href || ''
        });
    }
    if (activateExistingTagByRoute(route, text)) return;
    item.click();
}

// 加载收藏列表
function loadFavorites(callback) {
    chrome.storage.sync.get(['favoriteMenuItems'], (result) => {
        favoriteMenuItems = result.favoriteMenuItems || [];
        console.log('ERP Menu Plugin: Loaded favorites:', favoriteMenuItems.length);
        if (callback) callback();
    });
}

// 保存收藏列表
function saveFavorites() {
    chrome.storage.sync.set({ favoriteMenuItems: favoriteMenuItems }, () => {
        console.log('ERP Menu Plugin: Saved favorites:', favoriteMenuItems.length);
    });
}

// 添加收藏按钮到菜单项
function addFavoriteButton(menuItem, topLevelMenuName = null) {
    // 检查是否已有收藏按钮
    if (menuItem.querySelector('.favorite-btn')) {
        return;
    }
    
    // 获取菜单项的真实文本（排除收藏按钮和图标）
    const itemText = getMenuItemText(menuItem);
    
    // 检查是否已收藏（需要匹配文本和路径）
    const itemPath = getMenuItemPath(menuItem);
    const fullPath = topLevelMenuName ? [topLevelMenuName, ...itemPath] : itemPath;
    const isFavorite = favoriteMenuItems.some(fav => {
        if (fav.text !== itemText) return false;
        // 比较路径
        const favPath = fav.path || [];
        if (favPath.length !== fullPath.length) return false;
        for (let i = 0; i < favPath.length; i++) {
            if (favPath[i] !== fullPath[i]) return false;
        }
        return true;
    });
    
    const favoriteBtn = document.createElement('span');
    favoriteBtn.className = `favorite-btn ${isFavorite ? 'favorited' : ''}`;
    favoriteBtn.innerHTML = isFavorite ? '★' : '☆';
    favoriteBtn.title = isFavorite ? '取消收藏' : '添加到收藏';
    
    favoriteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleFavorite(menuItem, itemText, favoriteBtn, topLevelMenuName);
    });
    
    // 确保菜单项有相对定位
    const computedStyle = window.getComputedStyle(menuItem);
    if (computedStyle.position === 'static') {
        menuItem.style.position = 'relative';
    }
    
    // 为按钮留出空间（如果还没有设置）
    const currentPaddingRight = computedStyle.paddingRight;
    const paddingRightValue = parseInt(currentPaddingRight) || 0;
    if (paddingRightValue < 30) {
        menuItem.style.paddingRight = '30px';
    }
    
    menuItem.appendChild(favoriteBtn);
}

// 切换收藏状态
function toggleFavorite(menuItem, itemText, favoriteBtn, topLevelMenuName = null) {
    // 获取菜单项的路径信息（包含顶级菜单名称）
    const itemPath = getMenuItemPath(menuItem);
    const fullPath = topLevelMenuName ? [topLevelMenuName, ...itemPath] : itemPath;
    
    // 查找匹配的收藏项（需要匹配文本和完整路径）
    const index = favoriteMenuItems.findIndex(fav => {
        if (fav.text !== itemText) return false;
        const favPath = fav.path || [];
        if (favPath.length !== fullPath.length) return false;
        for (let i = 0; i < favPath.length; i++) {
            if (favPath[i] !== fullPath[i]) return false;
        }
        return true;
    });
    
    if (index > -1) {
        // 取消收藏
        favoriteMenuItems.splice(index, 1);
        favoriteBtn.classList.remove('favorited');
        favoriteBtn.innerHTML = '☆';
        favoriteBtn.title = '添加到收藏';
        console.log('ERP Menu Plugin: Removed from favorites:', itemText, 'path:', fullPath);
    } else {
        // 添加收藏
        const orig = findOriginalMenuItem(itemText, itemPath, topLevelMenuName);
        const route = getMenuItemRouteInfo(orig) || {};
        favoriteMenuItems.push({
            text: itemText,
            path: fullPath,
            timestamp: Date.now(),
            routeName: route.name || '',
            routeKey: route.key || '',
            routeHref: route.href || ''
        });
        favoriteBtn.classList.add('favorited');
        favoriteBtn.innerHTML = '★';
        favoriteBtn.title = '取消收藏';
        console.log('ERP Menu Plugin: Added to favorites:', itemText, 'path:', fullPath);
    }
    
    saveFavorites();
    
    // 更新收藏标签页
    updateFavoritesTab();
}

// 获取菜单项的路径信息
function getMenuItemPath(menuItem) {
    const path = [];
    let current = menuItem;
    
    // 向上查找所有父级菜单标题
    while (current && current !== document.body) {
        const parentSubmenu = current.closest('.ivu-menu-submenu');
        if (parentSubmenu) {
            const title = parentSubmenu.querySelector('.ivu-menu-submenu-title');
            if (title) {
                const titleText = title.innerText.trim();
                if (titleText) {
                    path.unshift(titleText);
                }
            }
            current = parentSubmenu.parentElement;
        } else {
            break;
        }
    }
    
    return path;
}

// 添加收藏入口（结果在收藏按钮下方悬浮层，不占用左侧子菜单）
function addFavoritesTab(topMenuContainer) {
    const favoritesTab = document.createElement('div');
    favoritesTab.className = 'custom-top-menu-item favorites-tab';
    favoritesTab.innerHTML = '<span style="margin-right: 6px;">★</span><span>收藏</span>';
    favoritesTab.title = '收藏的菜单项';

    const favoritesDropdown = document.createElement('div');
    favoritesDropdown.className = 'favorites-dropdown';
    favoritesDropdown.style.display = 'none';
    favoritesTab.appendChild(favoritesDropdown);

    const hideFavoritesDropdown = () => {
        favoritesDropdown.style.display = 'none';
        favoritesDropdown.innerHTML = '';
        favoritesTab.classList.remove('favorites-open');
    };

    const toggleFavoritesDropdown = () => {
        const open = favoritesDropdown.style.display !== 'none' && favoritesDropdown.style.display !== '';
        if (open) {
            hideFavoritesDropdown();
            return;
        }
        // 打开前关掉搜索浮层，避免两层叠在一起
        const searchDropdown = topMenuContainer.querySelector('.menu-search-dropdown');
        if (searchDropdown) {
            searchDropdown.style.display = 'none';
            searchDropdown.innerHTML = '';
        }
        favoritesTab.classList.add('favorites-open');
        showFavoritesList(favoritesDropdown, hideFavoritesDropdown);
    };

    favoritesTab.addEventListener('click', (e) => {
        e.stopPropagation();
        // 点浮层内部不切换开关（由条目自己处理）
        if (e.target.closest('.favorites-dropdown')) return;
        toggleFavoritesDropdown();
    });

    document.addEventListener('click', (e) => {
        if (!e.isTrusted) return;
        if (!favoritesTab.contains(e.target)) {
            hideFavoritesDropdown();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            const open = favoritesDropdown.style.display !== 'none' && favoritesDropdown.style.display !== '';
            if (open) {
                e.preventDefault();
                e.stopPropagation();
                hideFavoritesDropdown();
            }
        }
    }, true);

    const firstMenuItem = topMenuContainer.querySelector('.custom-top-menu-item:not(.favorites-tab)');
    if (firstMenuItem) {
        topMenuContainer.insertBefore(favoritesTab, firstMenuItem);
    } else {
        topMenuContainer.appendChild(favoritesTab);
    }
}

// 在悬浮层显示收藏列表
function showFavoritesList(favoritesDropdown, hideFavoritesDropdown) {
    favoritesDropdown.innerHTML = '';
    favoritesDropdown.style.display = 'block';

    if (favoriteMenuItems.length === 0) {
        favoritesDropdown.innerHTML = '<div class="favorites-dropdown-header">暂无收藏的菜单项<br/><small style="opacity:0.75;">点击菜单项旁的☆图标可添加到收藏</small></div>';
        return;
    }

    const header = document.createElement('div');
    header.className = 'favorites-dropdown-header';
    header.textContent = `共 ${favoriteMenuItems.length} 个收藏`;
    favoritesDropdown.appendChild(header);

    const favoritesList = document.createElement('ul');
    favoritesList.className = 'ivu-menu favorites-list';
    favoritesList.style.background = 'transparent';

    const favoritesCopy = [...favoriteMenuItems];

    favoritesCopy.forEach((fav) => {
        const li = document.createElement('li');
        li.className = 'ivu-menu-item favorite-item';

        const pathText = fav.path && fav.path.length > 0 ? fav.path.join(' > ') : '';
        li.innerHTML = `
            <div class="favorite-item-main">
                ${pathText ? `<div class="favorite-item-path">${pathText}</div>` : ''}
                <div class="favorite-item-text">${fav.text}</div>
            </div>
            <span class="favorite-btn favorited" title="取消收藏">★</span>
        `;

        li.querySelector('.favorite-item-main').addEventListener('click', (e) => {
            e.stopPropagation();
            openFavorite(fav);
            if (typeof hideFavoritesDropdown === 'function') hideFavoritesDropdown();
        });

        li.querySelector('.favorite-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const itemIndex = favoriteMenuItems.findIndex(item => {
                if (item.text !== fav.text) return false;
                const a = item.path || [];
                const b = fav.path || [];
                if (a.length !== b.length) return false;
                for (let i = 0; i < a.length; i++) {
                    if (a[i] !== b[i]) return false;
                }
                return true;
            });
            if (itemIndex > -1) {
                favoriteMenuItems.splice(itemIndex, 1);
                saveFavorites();
                showFavoritesList(favoritesDropdown, hideFavoritesDropdown);
            }
        });

        favoritesList.appendChild(li);
    });

    favoritesDropdown.appendChild(favoritesList);
}

// 更新收藏浮层（若当前打开则刷新）
function updateFavoritesTab() {
    const favoritesTab = document.querySelector('.favorites-tab');
    const favoritesDropdown = favoritesTab && favoritesTab.querySelector('.favorites-dropdown');
    if (!favoritesDropdown) return;
    const open = favoritesDropdown.style.display !== 'none' && favoritesDropdown.style.display !== '';
    if (open) {
        showFavoritesList(favoritesDropdown, () => {
            favoritesDropdown.style.display = 'none';
            favoritesDropdown.innerHTML = '';
            favoritesTab.classList.remove('favorites-open');
        });
    }
}

// 添加搜索框（结果在搜索框下方悬浮层，不占用左侧子菜单）
function addSearchBox(topMenuContainer, subMenuContainer, rootMenuConfig) {
    const searchContainer = document.createElement('div');
    searchContainer.className = 'menu-search-container';
    
    const searchIcon = document.createElement('span');
    searchIcon.className = 'menu-search-icon';
    searchIcon.innerHTML = '🔍';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'menu-search-input';
    searchInput.placeholder = '搜索菜单... (Ctrl+K)';
    searchInput.title = '搜索菜单项，按 Ctrl+K 快速聚焦';

    const searchDropdown = document.createElement('div');
    searchDropdown.className = 'menu-search-dropdown';
    searchDropdown.style.display = 'none';
    
    searchContainer.appendChild(searchIcon);
    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(searchDropdown);
    
    // 插入到logo之后
    const logo = topMenuContainer.querySelector('.custom-top-logo');
    if (logo) {
        topMenuContainer.insertBefore(searchContainer, logo.nextSibling);
    } else {
        topMenuContainer.insertBefore(searchContainer, topMenuContainer.firstChild);
    }

    const hideSearchDropdown = () => {
        searchDropdown.style.display = 'none';
        searchDropdown.innerHTML = '';
    };
    
    // 搜索功能
    let searchTimeout = null;
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        // 防抖处理
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (query.length > 0) {
                // 打开搜索浮层前关掉收藏浮层
                const favDropdown = topMenuContainer.querySelector('.favorites-dropdown');
                const favTab = topMenuContainer.querySelector('.favorites-tab');
                if (favDropdown) {
                    favDropdown.style.display = 'none';
                    favDropdown.innerHTML = '';
                }
                if (favTab) favTab.classList.remove('favorites-open');
                performSearch(query, searchDropdown, rootMenuConfig);
            } else {
                hideSearchDropdown();
            }
        }, 300);
    });
    
    // 键盘快捷键 Ctrl+K 聚焦搜索框；ESC 关闭搜索浮层
    document.addEventListener('keydown', (e) => {
        // Ctrl+K 或 Cmd+K
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
            return;
        }
        // ESC：只要浮层开着就关闭（不依赖输入框焦点，捕获阶段优先于页面其它逻辑）
        if (e.key === 'Escape' || e.key === 'Esc') {
            const dropdownOpen = searchDropdown.style.display !== 'none' && searchDropdown.style.display !== '';
            if (dropdownOpen || document.activeElement === searchInput || searchInput.value.trim() !== '') {
                e.preventDefault();
                e.stopPropagation();
                searchInput.value = '';
                searchInput.blur();
                hideSearchDropdown();
            }
        }
    }, true);
    
    // 点击搜索框/悬浮层外部时关闭悬浮层（忽略程序触发的 click，避免切模块菜单时关掉浮层）
    document.addEventListener('click', (e) => {
        if (!e.isTrusted) return;
        if (!searchContainer.contains(e.target)) {
            hideSearchDropdown();
        }
    });
}

// 执行搜索
function performSearch(query, searchDropdown, rootMenuConfig) {
    const results = [];
    const searchLower = query.toLowerCase();
    
    // 遍历所有顶级菜单项
    const topLevelItems = Array.from(rootMenuConfig.children).filter(node => node.tagName === 'LI');
    
    topLevelItems.forEach(topLi => {
        const topTitle = topLi.querySelector('.ivu-menu-submenu-title');
        const topText = topTitle ? (topTitle.innerText || '').trim() : '';
        
        // 搜索所有子菜单项
        const allSubItems = topLi.querySelectorAll('.ivu-menu-item');
        allSubItems.forEach(item => {
            const itemText = getMenuItemText(item);
            const itemTextLower = itemText.toLowerCase();
            
            // 检查是否匹配
            if (itemTextLower.includes(searchLower)) {
                // 获取菜单项的完整路径
                const path = getMenuItemFullPathFromOriginal(item);
                const fullPath = topText ? [topText, ...path] : path;
                
                results.push({
                    text: itemText,
                    path: fullPath,
                    topLevelMenu: topText,
                    element: item
                });
            }
        });
    });
    
    // 显示搜索结果到悬浮层
    displaySearchResults(results, searchDropdown, query);
}

// 从原始菜单项获取完整路径
function getMenuItemFullPathFromOriginal(menuItem) {
    const path = [];
    let current = menuItem;
    
    // 向上查找所有父级菜单标题
    while (current && current !== document.body) {
        const parentSubmenu = current.closest('.ivu-menu-submenu');
        if (parentSubmenu) {
            const title = parentSubmenu.querySelector('.ivu-menu-submenu-title');
            if (title) {
                const titleText = title.innerText.trim();
                if (titleText) {
                    path.unshift(titleText);
                }
            }
            current = parentSubmenu.parentElement;
        } else {
            break;
        }
    }
    
    return path;
}

// 在悬浮层显示搜索结果（不改写左侧子菜单）
function displaySearchResults(results, searchDropdown, query) {
    searchDropdown.innerHTML = '';
    searchDropdown.style.display = 'block';
    
    if (results.length === 0) {
        searchDropdown.innerHTML = `<div class="search-results-header">未找到匹配的菜单项<br/><small style="opacity:0.75;">搜索关键词: "${query}"</small></div>`;
        return;
    }
    
    const header = document.createElement('div');
    header.className = 'search-results-header';
    header.innerHTML = `找到 ${results.length} 个匹配项`;
    searchDropdown.appendChild(header);

    const resultsList = document.createElement('ul');
    resultsList.className = 'ivu-menu search-results-list';
    resultsList.style.background = 'transparent';
    
    results.forEach((result) => {
        const li = document.createElement('li');
        li.className = 'ivu-menu-item search-result-item';
        
        const pathText = result.path.length > 0 ? result.path.join(' > ') + ' > ' : '';
        const displayText = result.text;
        const highlightedText = highlightMatch(displayText, query);
        
        li.innerHTML = `
            <div class="search-result-path">${pathText}</div>
            <div class="search-result-text">${highlightedText}</div>
        `;
        
        li.addEventListener('click', (e) => {
            e.stopPropagation();
            if (result.topLevelMenu) suspendAutoTagSync(result.topLevelMenu, result.text);
            triggerOriginalClick(result.text, result.path.slice(1), result.topLevelMenu);
            syncLeftMenuFromMenuItem(result.topLevelMenu, result.text);

            searchDropdown.querySelectorAll('.search-result-item-active').forEach(el => {
                el.classList.remove('search-result-item-active');
            });
            li.classList.add('search-result-item-active');
        });
        
        resultsList.appendChild(li);
    });
    
    searchDropdown.appendChild(resultsList);
}

// 高亮匹配的文本
function highlightMatch(text, query) {
    if (!query) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// 从存储中读取开关状态
function loadToggleState() {
    chrome.storage.sync.get(['menuModificationEnabled', 'headerActionsPosition'], (result) => {
        const enabled = result.menuModificationEnabled !== false; // 默认为true
        headerActionsPosition = result.headerActionsPosition === 'left' ? 'left' : 'right';
        isMenuModificationEnabled = enabled;
        console.log('ERP Menu Plugin: Menu modification enabled:', enabled, 'header position:', headerActionsPosition);
        
        if (enabled) {
            applyCustomLayout();
        } else {
            restoreOriginalMenu();
        }
    });
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleMenuModification') {
        isMenuModificationEnabled = request.enabled;
        console.log('ERP Menu Plugin: Toggle state changed to:', request.enabled);
        
        if (request.enabled) {
            applyCustomLayout();
        } else {
            restoreOriginalMenu();
        }
        
        sendResponse({ success: true });
    } else if (request.action === 'setHeaderActionsPosition') {
        headerActionsPosition = request.position === 'left' ? 'left' : 'right';
        const topMenuContainer = document.querySelector('.custom-top-menu-container');
        const wrapper = document.querySelector('.custom-header-actions');
        if (topMenuContainer && wrapper && isMenuModificationEnabled) {
            applyHeaderActionsPosition(topMenuContainer, wrapper);
            const collapseFunc = topMenuContainer.__collapseFunc;
            if (collapseFunc) {
                setTimeout(collapseFunc, 50);
            }
        }
        sendResponse({ success: true });
    }
    return true;
});

// 监听 DOM 变化，适配动态加载的单页应用
const observer = new MutationObserver((mutations) => {
    // 只有在启用状态下才检查和应用布局
    if (!isMenuModificationEnabled) return;
    
    // 检查原来的菜单容器是否出现
    if (document.querySelector('.sider-memutree-conainter') && !document.querySelector('.custom-top-menu-container')) {
        applyCustomLayout();
        return;
    }

    // 顶栏已改造，但原 header 控件晚出现时补迁
    const topMenu = document.querySelector('.custom-top-menu-container');
    const customContent = document.querySelector('.custom-content-con');
    if (topMenu && customContent && !topMenu.contains(customContent)) {
        relocateHeaderActions(topMenu);
    }

    if (topMenu && document.querySelector('.tags-nav')) {
        initTagNavSync();
    }
});

// 开始监听 body
observer.observe(document.body, { childList: true, subtree: true });

// 初始化横向菜单折叠功能
function initHorizontalMenuCollapse(topMenuContainer) {
    // 检查是否启用折叠功能（默认启用）
    chrome.storage.sync.get(['horizontalMenuCollapseEnabled'], (result) => {
        const collapseEnabled = result.horizontalMenuCollapseEnabled !== false; // 默认为true
        
        if (collapseEnabled) {
            // 创建应用折叠的函数
            const applyCollapse = () => {
                applyMenuCollapse(topMenuContainer);
            };
            
            // 保存函数引用，以便后续调用
            topMenuContainer.__collapseFunc = applyCollapse;
            
            // 立即执行一次
            applyCollapse();
            
            // 监听窗口大小变化
            let resizeTimeout = null;
            const resizeHandler = () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    applyCollapse();
                }, 200);
            };
            
            window.addEventListener('resize', resizeHandler);
            
            // 保存resize handler以便后续清理（如果需要）
            topMenuContainer.__resizeHandler = resizeHandler;
        }
    });
}

// 应用菜单折叠逻辑
function applyMenuCollapse(topMenuContainer) {
    // 移除已存在的"更多"菜单和下拉菜单
    const existingMoreMenu = topMenuContainer.querySelector('.custom-more-menu');
    const existingDropdown = topMenuContainer.querySelector('.custom-more-dropdown');
    if (existingMoreMenu) existingMoreMenu.remove();
    if (existingDropdown) existingDropdown.remove();
    
    // 移除所有菜单项的隐藏状态
    const allMenuItems = topMenuContainer.querySelectorAll('.custom-top-menu-item:not(.custom-more-menu):not(.favorites-tab)');
    allMenuItems.forEach(item => {
        item.style.display = '';
        item.style.visibility = 'visible';
        item.classList.remove('menu-item-hidden');
    });
    
    // 等待DOM更新
    requestAnimationFrame(() => {
        // 获取容器可用宽度（排除logo、搜索框、收藏标签页、顶栏操作区）
        const logo = topMenuContainer.querySelector('.custom-top-logo');
        const searchContainer = topMenuContainer.querySelector('.menu-search-container');
        const favoritesTab = topMenuContainer.querySelector('.favorites-tab');
        const headerActions = topMenuContainer.querySelector('.custom-header-actions');
        
        const containerRect = topMenuContainer.getBoundingClientRect();
        let availableWidth = containerRect.width;
        
        // 减去固定元素的宽度
        if (logo) {
            availableWidth -= logo.getBoundingClientRect().width;
        }
        if (searchContainer) {
            availableWidth -= searchContainer.getBoundingClientRect().width;
        }
        if (favoritesTab) {
            availableWidth -= favoritesTab.getBoundingClientRect().width;
        }
        if (headerActions) {
            availableWidth -= headerActions.getBoundingClientRect().width;
        }
        
        // 为"更多"菜单预留空间
        const moreMenuWidth = 80;
        availableWidth -= moreMenuWidth;
        
        // 如果可用宽度不足，不启用折叠
        if (availableWidth < 200) {
            return;
        }
        
        // 计算哪些菜单项需要折叠
        let totalWidth = 0;
        const menuItems = Array.from(allMenuItems);
        const itemsToCollapse = [];
        
        for (let i = 0; i < menuItems.length; i++) {
            const item = menuItems[i];
            const itemRect = item.getBoundingClientRect();
            const itemWidth = itemRect.width || item.offsetWidth;
            
            if (totalWidth + itemWidth > availableWidth && i > 0) {
                // 从当前项开始，所有后续项都需要折叠
                for (let j = i; j < menuItems.length; j++) {
                    itemsToCollapse.push(menuItems[j]);
                }
                break;
            }
            
            totalWidth += itemWidth;
        }
        
        // 如果有需要折叠的菜单项，创建"更多"菜单
        if (itemsToCollapse.length > 0) {
            // 隐藏需要折叠的菜单项
            itemsToCollapse.forEach(item => {
                item.style.display = 'none';
                item.classList.add('menu-item-hidden');
            });
            
            // 创建"更多"菜单按钮（样式与左侧模块菜单项一致）
            const moreMenu = document.createElement('div');
            moreMenu.className = 'custom-top-menu-item custom-more-menu';
            moreMenu.innerHTML = '<i class="ivu-icon ivu-icon-ios-more"></i><span>更多</span><i class="ivu-icon ivu-icon-ios-arrow-down custom-more-arrow"></i>';
            moreMenu.title = `更多菜单 (${itemsToCollapse.length}项)`;
            
            // 创建下拉菜单容器
            const dropdownMenu = document.createElement('div');
            dropdownMenu.className = 'custom-more-dropdown';
            dropdownMenu.style.display = 'none';
            
            // 添加折叠的菜单项到下拉菜单
            itemsToCollapse.forEach(item => {
                const dropdownItem = document.createElement('div');
                dropdownItem.className = 'custom-top-menu-item custom-dropdown-item';
                
                // 复制菜单项的内容
                const itemContent = item.cloneNode(true);
                dropdownItem.innerHTML = itemContent.innerHTML;
                dropdownItem.title = item.title || itemContent.querySelector('span')?.innerText || '';
                
                // 复制激活状态
                if (item.classList.contains('active')) {
                    dropdownItem.classList.add('active');
                }
                
                dropdownItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // 触发原始菜单项的点击
                    const originalText = dropdownItem.querySelector('span')?.innerText;
                    const originalItem = Array.from(allMenuItems).find(orig => {
                        const origText = orig.querySelector('span')?.innerText;
                        return origText === originalText;
                    });
                    if (originalItem) {
                        originalItem.click();
                    }
                    dropdownMenu.style.display = 'none';
                    const arrow = moreMenu.querySelector('.custom-more-arrow');
                    if (arrow) {
                        arrow.style.transform = 'rotate(0deg)';
                    }
                });
                
                dropdownMenu.appendChild(dropdownItem);
            });
            
            // 点击"更多"按钮显示/隐藏下拉菜单
            moreMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = dropdownMenu.style.display !== 'none';
                dropdownMenu.style.display = isVisible ? 'none' : 'block';
                
                // 更新箭头方向
                const arrow = moreMenu.querySelector('.custom-more-arrow');
                if (arrow) {
                    arrow.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
                }
            });
            
            // 点击外部关闭下拉菜单
            const closeDropdown = (e) => {
                if (!moreMenu.contains(e.target)) {
                    dropdownMenu.style.display = 'none';
                    const arrow = moreMenu.querySelector('.custom-more-arrow');
                    if (arrow) {
                        arrow.style.transform = 'rotate(0deg)';
                    }
                }
            };
            
            // 使用事件委托，避免重复绑定
            document.addEventListener('click', closeDropdown);
            
            // 下拉挂到「更多」内部，相对按钮定位（避免贴到整条顶栏最右侧）
            moreMenu.appendChild(dropdownMenu);

            // 「更多」与右侧顶栏操作区交换：更多紧挨菜单，操作区（消息/用户等）在最右侧
            const rightHeaderActions = topMenuContainer.querySelector('.custom-header-actions.position-right');
            if (rightHeaderActions) {
                topMenuContainer.insertBefore(moreMenu, rightHeaderActions);
            } else {
                topMenuContainer.appendChild(moreMenu);
            }
        }
    });
}

// 初始化：加载收藏列表并读取状态
loadFavorites(() => {
    loadToggleState();
});