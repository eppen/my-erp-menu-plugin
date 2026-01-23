// 获取DOM元素
const toggleSwitch = document.getElementById('toggleSwitch');
const statusText = document.getElementById('statusText');

// 从存储中读取开关状态，默认为true（启用）
function loadToggleState() {
  chrome.storage.sync.get(['menuModificationEnabled'], (result) => {
    const isEnabled = result.menuModificationEnabled !== false; // 默认为true
    updateUI(isEnabled);
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

// 绑定点击事件
toggleSwitch.addEventListener('click', toggleState);

// 页面加载时读取状态
loadToggleState();