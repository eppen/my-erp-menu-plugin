// 定位和修改 DOM 的主要逻辑
function applyCustomLayout() {
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
                
                // 递归确保所有层级的 ul 都不受原有 display:none 的影响（可选）
                // clonedUl.querySelectorAll('ul').forEach(u => u.style.display = 'block');
                
                initSubMenuInteractions(clonedUl);
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

    console.log('ERP Menu Plugin: Layout transformation applied successfully.');
}

// 辅助函数：处理子菜单的折叠展开逻辑
// 因为直接克隆了 DOM，原有的 Vue/iView 事件绑定失效了，需要手动实现简单的折叠效果
function initSubMenuInteractions(rootElement) {
    // 找到所有的 子菜单标题 (ivu-menu-submenu-title)
    const titles = rootElement.querySelectorAll('.ivu-menu-submenu-title');
    
    titles.forEach(title => {
        // 对应的下一个兄弟元素应该是 ul
        const nextUl = title.nextElementSibling;
        
        // 修正样式
        title.style.paddingLeft = '10px'; // 重置 padding，避免层级过深太靠右(看情况)
        // 也可以保留原 style
        
        if (nextUl && nextUl.tagName === 'UL') {
            title.style.cursor = 'pointer';
            
            // 添加折叠指示箭头逻辑（如果原 DOM 有箭头 icon）
            const arrow = title.querySelector('.ivu-icon-ios-arrow-down');
            
            // 绑定点击 TODO: 优化手感
            title.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = nextUl.style.display !== 'none';
                
                if (isVisible) {
                    nextUl.style.display = 'none';
                    if (arrow) arrow.style.transform = 'rotate(-90deg)';
                } else {
                    nextUl.style.display = 'block';
                    if (arrow) arrow.style.transform = 'rotate(0deg)';
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
        item.addEventListener('click', () => {
             // 视觉高亮
             rootElement.querySelectorAll('.ivu-menu-item').forEach(i => i.classList.remove('ivu-menu-item-active', 'ivu-menu-item-selected'));
             item.classList.add('ivu-menu-item-active', 'ivu-menu-item-selected');
             
             // 尝试触发原始菜单项的点击
             // 我们需要一种方式关联回原始节点。
             // 由于我们是完全克隆，没有 ID 关联。
             // 可以尝试通过文本内容匹配，或者在 clone 前打标记。
             
             // 简易方案：文本匹配 (有风险，重名)
             const itemText = item.innerText.trim();
             triggerOriginalClick(itemText);
        });
    });
}

function triggerOriginalClick(text) {
    // 在隐藏的原始菜单中找到对应文本的项并点击
    const originalSidebar = document.querySelector('.sider-memutree-conainter');
    if (!originalSidebar) return;
    
    // 深度优先查找
    const allItems = originalSidebar.querySelectorAll('.ivu-menu-item');
    for (let i = 0; i < allItems.length; i++) {
        if (allItems[i].innerText.trim() === text) {
            console.log('Triggering original menu click for:', text);
            allItems[i].click();
            return;
        }
    }
}

// 监听 DOM 变化，适配动态加载的单页应用
const observer = new MutationObserver((mutations) => {
    // 检查原来的菜单容器是否出现
    if (document.querySelector('.sider-memutree-conainter') && !document.querySelector('.custom-top-menu-container')) {
        applyCustomLayout();
    }
});

// 开始监听 body
observer.observe(document.body, { childList: true, subtree: true });

// 立即尝试运行一次
applyCustomLayout();