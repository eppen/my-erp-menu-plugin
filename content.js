// 全局状态：是否启用菜单调整
let isMenuModificationEnabled = true;

// 收藏列表
let favoriteMenuItems = [];

// 当前激活的顶级菜单名称
let currentTopLevelMenuName = null;

// 顶栏操作区位置：'left' | 'right'
let headerActionsPosition = 'right';

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

        // 默认选中第一个
        if (index === 0) {
            // 使用 setTimeout 确保 DOM 渲染后再点击
            setTimeout(() => topMenuItem.click(), 100);
        }
    });

    // 加载收藏列表并添加收藏菜单标签页
    loadFavorites(() => {
        addFavoritesTab(topMenuContainer, subMenuContainer);
    });

    // 添加搜索功能
    addSearchBox(topMenuContainer, subMenuContainer, rootMenuConfig);

    // 将原页面右上角按钮/下拉迁入插件顶栏，并隐藏原 header 行
    relocateHeaderActions(topMenuContainer);

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
             triggerOriginalClick(itemText, itemPath, topMenu);
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

function triggerOriginalClick(text, path = [], topLevelMenuName = null) {
    // 在隐藏的原始菜单中找到对应文本和路径的项并点击
    const originalSidebar = document.querySelector('.sider-memutree-conainter');
    if (!originalSidebar) return;
    
    // 如果提供了顶级菜单名称，先找到该顶级菜单下的所有菜单项
    let itemsToSearch = [];
    if (topLevelMenuName) {
        // 找到所有顶级菜单项
        const rootMenu = originalSidebar.querySelector('.ivu-menu');
        if (rootMenu) {
            const topLevelItems = Array.from(rootMenu.children).filter(node => node.tagName === 'LI');
            for (const topLi of topLevelItems) {
                const topTitle = topLi.querySelector('.ivu-menu-submenu-title');
                if (topTitle && topTitle.innerText.trim() === topLevelMenuName) {
                    // 找到匹配的顶级菜单，获取其下所有菜单项
                    itemsToSearch = topLi.querySelectorAll('.ivu-menu-item');
                    break;
                }
            }
        }
    }
    
    // 如果没有找到或没有提供顶级菜单名称，搜索所有菜单项
    if (itemsToSearch.length === 0) {
        itemsToSearch = originalSidebar.querySelectorAll('.ivu-menu-item');
    }
    
    console.log('ERP Menu Plugin: Searching for menu item:', {
        text: text,
        path: path,
        topLevelMenuName: topLevelMenuName,
        itemsToSearchCount: itemsToSearch.length
    });
    
    for (let i = 0; i < itemsToSearch.length; i++) {
        const item = itemsToSearch[i];
        // 获取菜单项的真实文本（排除可能的图标等）
        const itemText = item.innerText.trim();
        
        // 文本必须匹配
        if (itemText !== text) continue;
        
        console.log('ERP Menu Plugin: Found matching text:', itemText);
        
        // 如果有路径信息，验证路径是否匹配
        if (path && path.length > 0) {
            const itemPath = getMenuItemFullPath(item);
            
            // 比较路径
            // itemPath 可能包含顶级菜单名称，path 也可能包含或不包含
            // 如果提供了 topLevelMenuName，我们应该确保路径匹配时不包含顶级菜单名称
            let pathToMatch = path.slice();
            let itemPathToMatch = itemPath.slice();
            
            // 如果 itemPath 的第一个元素是顶级菜单名称，移除它
            if (topLevelMenuName && itemPathToMatch.length > 0 && itemPathToMatch[0] === topLevelMenuName) {
                itemPathToMatch = itemPathToMatch.slice(1);
            }
            
            // 如果 path 的第一个元素是顶级菜单名称，移除它
            if (topLevelMenuName && pathToMatch.length > 0 && pathToMatch[0] === topLevelMenuName) {
                pathToMatch = pathToMatch.slice(1);
            }
            
            // 比较路径长度和内容
            if (itemPathToMatch.length === pathToMatch.length) {
                let pathMatch = true;
                for (let j = 0; j < pathToMatch.length; j++) {
                    if (itemPathToMatch[j] !== pathToMatch[j]) {
                        pathMatch = false;
                        break;
                    }
                }
                if (pathMatch) {
                    console.log('Triggering original menu click for:', text, 'with path:', path, 'in top menu:', topLevelMenuName);
                    item.click();
                    return;
                }
            }
            
            // 如果精确匹配失败，尝试模糊匹配（只比较最后几个元素）
            if (itemPathToMatch.length >= pathToMatch.length && pathToMatch.length > 0) {
                const itemPathSuffix = itemPathToMatch.slice(-pathToMatch.length);
                let pathMatch = true;
                for (let j = 0; j < pathToMatch.length; j++) {
                    if (itemPathSuffix[j] !== pathToMatch[j]) {
                        pathMatch = false;
                        break;
                    }
                }
                if (pathMatch) {
                    console.log('ERP Menu Plugin: Path fuzzy match! Triggering click for:', text);
                    item.click();
                    return;
                }
            }
            
            // 如果路径匹配失败，但有顶级菜单名称限制，且文本匹配，也允许点击（降级处理）
            if (topLevelMenuName) {
                console.log('ERP Menu Plugin: Path mismatch, but text matches in correct top menu. Triggering click for:', text);
                item.click();
                return;
            }
        } else {
            // 没有路径信息，但有顶级菜单名称，只在该顶级菜单下匹配
            if (topLevelMenuName) {
                console.log('Triggering original menu click for:', text, 'in top menu:', topLevelMenuName);
                item.click();
                return;
            } else {
                // 没有路径和顶级菜单信息，使用文本匹配（兼容旧代码）
                console.log('Triggering original menu click for:', text, '(text only)');
                item.click();
                return;
            }
        }
    }
    
    console.warn('ERP Menu Plugin: Could not find menu item:', text, 'with path:', path, 'in top menu:', topLevelMenuName);
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
        favoriteMenuItems.push({
            text: itemText,
            path: fullPath,
            timestamp: Date.now()
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

// 添加收藏标签页
function addFavoritesTab(topMenuContainer, subMenuContainer) {
    const favoritesTab = document.createElement('div');
    favoritesTab.className = 'custom-top-menu-item favorites-tab';
    // 使用星号图标，如果页面有iView图标库则使用，否则使用文本
    favoritesTab.innerHTML = '<span style="margin-right: 6px;">★</span><span>收藏</span>';
    favoritesTab.title = '收藏的菜单项';
    
    favoritesTab.addEventListener('click', () => {
        // 样式激活状态切换
        document.querySelectorAll('.custom-top-menu-item').forEach(el => el.classList.remove('active'));
        favoritesTab.classList.add('active');
        
        // 显示收藏列表
        showFavoritesList(subMenuContainer);
    });
    
    // 插入到logo之后（第一个菜单项之前）
    const firstMenuItem = topMenuContainer.querySelector('.custom-top-menu-item:not(.favorites-tab)');
    if (firstMenuItem) {
        topMenuContainer.insertBefore(favoritesTab, firstMenuItem);
    } else {
        // 如果没有其他菜单项，追加到末尾
        topMenuContainer.appendChild(favoritesTab);
    }
}

// 显示收藏列表
function showFavoritesList(subMenuContainer) {
    subMenuContainer.innerHTML = '';
    
    if (favoriteMenuItems.length === 0) {
        subMenuContainer.innerHTML = '<div class="no-submenu-tip">暂无收藏的菜单项<br/><small style="color: #666;">点击菜单项旁的☆图标可添加到收藏</small></div>';
        return;
    }
    
    const favoritesList = document.createElement('ul');
    favoritesList.className = 'ivu-menu favorites-list';
    favoritesList.style.background = 'transparent';
    
    // 创建副本以避免在遍历时修改数组导致的问题
    const favoritesCopy = [...favoriteMenuItems];
    
    favoritesCopy.forEach((fav, index) => {
        const li = document.createElement('li');
        li.className = 'ivu-menu-item favorite-item';
        
        const pathText = fav.path.length > 0 ? fav.path.join(' > ') + ' > ' : '';
        li.innerHTML = `
            <span class="favorite-item-text">${pathText}${fav.text}</span>
            <span class="favorite-btn favorited" data-text="${fav.text.replace(/"/g, '&quot;')}">★</span>
        `;
        
        // 点击菜单项
        const textSpan = li.querySelector('.favorite-item-text');
        textSpan.style.cursor = 'pointer';
        textSpan.addEventListener('click', () => {
            // 使用保存的路径信息进行精确匹配
            // 如果路径中有顶级菜单名称，提取它
            const topMenu = fav.path && fav.path.length > 0 ? fav.path[0] : null;
            const subPath = fav.path && fav.path.length > 1 ? fav.path.slice(1) : [];
            triggerOriginalClick(fav.text, subPath, topMenu);
        });
        
        // 点击收藏按钮取消收藏
        const btn = li.querySelector('.favorite-btn');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // 根据文本查找并删除
            const itemIndex = favoriteMenuItems.findIndex(item => item.text === fav.text);
            if (itemIndex > -1) {
                favoriteMenuItems.splice(itemIndex, 1);
                saveFavorites();
                showFavoritesList(subMenuContainer);
            }
        });
        
        favoritesList.appendChild(li);
    });
    
    subMenuContainer.appendChild(favoritesList);
}

// 更新收藏标签页
function updateFavoritesTab() {
    const favoritesTab = document.querySelector('.favorites-tab');
    if (favoritesTab && favoritesTab.classList.contains('active')) {
        const subMenuContainer = document.querySelector('.custom-sub-menu-container');
        if (subMenuContainer) {
            showFavoritesList(subMenuContainer);
        }
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
                performSearch(query, searchDropdown, rootMenuConfig);
            } else {
                hideSearchDropdown();
            }
        }, 300);
    });
    
    // 键盘快捷键 Ctrl+K 聚焦搜索框
    document.addEventListener('keydown', (e) => {
        // Ctrl+K 或 Cmd+K
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        }
        // ESC 键清除搜索并关闭悬浮层
        if (e.key === 'Escape' && (document.activeElement === searchInput || searchDropdown.style.display !== 'none')) {
            searchInput.value = '';
            searchInput.blur();
            hideSearchDropdown();
        }
    });
    
    // 点击搜索框/悬浮层外部时关闭悬浮层
    document.addEventListener('click', (e) => {
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
            // 只打开页面，保留悬浮层以便继续点选其它结果
            triggerOriginalClick(result.text, result.path.slice(1), result.topLevelMenu);

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