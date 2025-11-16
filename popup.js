let isDownloading = false;
let downloadFolder = '';

const selectFolderBtn = document.getElementById('selectFolder');
const startDownloadBtn = document.getElementById('startDownload');
const stopDownloadBtn = document.getElementById('stopDownload');
const statusDiv = document.getElementById('status');
const folderPathDiv = document.getElementById('folderPath');

// Load saved folder name and check download status
chrome.storage.local.get(['downloadFolder', 'isDownloading', 'lastStatus'], (result) => {
  if (result.downloadFolder) {
    downloadFolder = result.downloadFolder;
    folderPathDiv.textContent = `📁 Downloads/${downloadFolder}`;
    folderPathDiv.style.display = 'block';
    startDownloadBtn.disabled = false;
  }
  
  // Check if download is running in background
  if (result.isDownloading) {
    isDownloading = true;
    selectFolderBtn.disabled = true;
    startDownloadBtn.disabled = true;
    stopDownloadBtn.disabled = false;
    if (result.lastStatus) {
      updateStatus(result.lastStatus);
    }
  }
});

selectFolderBtn.addEventListener('click', async () => {
  try {
    const folder = prompt('Enter subfolder name in Downloads (e.g., "GoPro"):\n\nTip: You can change this anytime to switch folders!', downloadFolder || 'GoPro');
    if (folder && folder.trim()) {
      downloadFolder = folder.trim();
      await chrome.storage.local.set({ downloadFolder: downloadFolder });
      folderPathDiv.textContent = `📁 Downloads/${downloadFolder}`;
      folderPathDiv.style.display = 'block';
      startDownloadBtn.disabled = false;
      updateStatus('✓ Folder configured - will skip files that exist');
    }
  } catch (error) {
    updateStatus('❌ Error: ' + error.message);
  }
});

startDownloadBtn.addEventListener('click', async () => {
  if (!downloadFolder) {
    updateStatus('❌ Please select a folder first');
    return;
  }
  
  isDownloading = true;
  selectFolderBtn.disabled = true;
  startDownloadBtn.disabled = true;
  stopDownloadBtn.disabled = false;
  
  updateStatus('🔍 Starting download in background...');
  updateStatus('You can close this popup - download will continue in background');
  
  // Send message to background script
  chrome.runtime.sendMessage({ 
    action: 'startDownload',
    folder: downloadFolder
  });
});

stopDownloadBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopDownload' });
  isDownloading = false;
  selectFolderBtn.disabled = false;
  startDownloadBtn.disabled = false;
  stopDownloadBtn.disabled = true;
  updateStatus('⏹️ Download stopped by user');
});

// Listen for status updates from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'status') {
    updateStatus(message.text);
  } else if (message.type === 'complete') {
    isDownloading = false;
    selectFolderBtn.disabled = false;
    startDownloadBtn.disabled = false;
    stopDownloadBtn.disabled = true;
  } else if (message.type === 'error') {
    updateStatus('❌ ' + message.text);
    isDownloading = false;
    selectFolderBtn.disabled = false;
    startDownloadBtn.disabled = false;
    stopDownloadBtn.disabled = true;
  }
});

function updateStatus(text) {
  statusDiv.textContent = text;
  statusDiv.classList.add('visible');
}
