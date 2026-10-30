// 获取DOM元素
const toggleSwitch = document.getElementById('toggleSwitch');
const statusText = document.getElementById('statusText');
const headerPositionSelect = document.getElementById('headerPositionSelect');
const rewriteHrefSwitch = document.getElementById('rewriteHrefSwitch');

// 从存储中读取开关状态，默认为true（启用）
function loadToggleState() {
  chrome.storage.sync.get(['menuModificationEnabled', 'headerActionsPosition', 'rewriteMenuHrefToEntry'], (result) => {
    const isEnabled = result.menuModificationEnabled !== false; // 默认为true
    const position = result.headerActionsPosition === 'left' ? 'left' : 'right';
    const rewriteEnabled = result.rewriteMenuHrefToEntry !== false; // 默认为true
    headerPositionSelect.value = position;
    updateUI(isEnabled);
    updateRewriteHrefUI(rewriteEnabled);
  });
}

// 更新UI显示
function updateUI(isEnabled) {
  if (isEnabled) {
    toggleSwitch.classList.add('active');
    statusText.textContent = '菜单调整已启用';
    statusText.style.color = '#2d8cf0';
  } else {
    toggleSwitch.classList.remove('active');
    statusText.textContent = '菜单调整已禁用';
    statusText.style.color = '#999';
  }
  headerPositionSelect.disabled = !isEnabled;
  rewriteHrefSwitch.style.opacity = isEnabled ? '1' : '0.5';
  rewriteHrefSwitch.style.pointerEvents = isEnabled ? '' : 'none';
}

function updateRewriteHrefUI(enabled) {
  if (enabled) {
    rewriteHrefSwitch.classList.add('active');
  } else {
    rewriteHrefSwitch.classList.remove('active');
  }
}

// 切换开关状态
function toggleState() {
  chrome.storage.sync.get(['menuModificationEnabled'], (result) => {
    const currentState = result.menuModificationEnabled !== false;
    const newState = !currentState;
    
    chrome.storage.sync.set({ menuModificationEnabled: newState }, () => {
      updateUI(newState);
      
      // 通知content script状态变化
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'toggleMenuModification', 
            enabled: newState 
          });
        }
      });
    });
  });
}

// 顶栏按钮左右位置
function changeHeaderPosition() {
  const position = headerPositionSelect.value === 'left' ? 'left' : 'right';
  chrome.storage.sync.set({ headerActionsPosition: position }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'setHeaderActionsPosition',
          position: position
        });
      }
    });
  });
}

// 是否将菜单绝对 URL 改写为当前入口
function toggleRewriteHref() {
  chrome.storage.sync.get(['rewriteMenuHrefToEntry'], (result) => {
    const currentState = result.rewriteMenuHrefToEntry !== false;
    const newState = !currentState;

    chrome.storage.sync.set({ rewriteMenuHrefToEntry: newState }, () => {
      updateRewriteHrefUI(newState);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'setRewriteMenuHrefToEntry',
            enabled: newState
          });
        }
      });
    });
  });
}

// 绑定点击事件
toggleSwitch.addEventListener('click', toggleState);
headerPositionSelect.addEventListener('change', changeHeaderPosition);
rewriteHrefSwitch.addEventListener('click', toggleRewriteHref);

// 页面加载时读取状态
loadToggleState();
