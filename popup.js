let isDownloading = false;
let downloadFolder = '';

const selectFolderBtn = document.getElementById('selectFolder');
const startDownloadBtn = document.getElementById('startDownload');
const stopDownloadBtn = document.getElementById('stopDownload');
const importSummaryBtn = document.getElementById('importSummary');
const importFileInput = document.getElementById('importFile');
const exportSummaryBtn = document.getElementById('exportSummary');
const clearSummaryBtn = document.getElementById('clearSummary');
const statusDiv = document.getElementById('status');
const folderPathDiv = document.getElementById('folderPath');

// Load saved folder name and check download status
chrome.storage.local.get(['downloadFolder', 'isDownloading', 'lastStatus', 'downloadSummary'], (result) => {
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
  
  // Show summary statistics
  if (result.downloadSummary) {
    const count = Object.keys(result.downloadSummary).length;
    if (count > 0) {
      const totalSize = Object.values(result.downloadSummary).reduce((sum, file) => sum + (file.file_size || 0), 0);
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);
      exportSummaryBtn.textContent = `📥 Export Summary (${count} files, ${totalSizeMB} MB)`;
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

importSummaryBtn.addEventListener('click', () => {
  importFileInput.click();
});

importFileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    // Validate the format
    if (!data.files || typeof data.files !== 'object') {
      updateStatus('❌ Invalid summary file format');
      return;
    }
    
    // Merge with existing summary
    const result = await chrome.storage.local.get(['downloadSummary']);
    const existingSummary = result.downloadSummary || {};
    const importedFiles = data.files;
    
    // Count new vs existing
    let newCount = 0;
    let updatedCount = 0;
    
    for (const [id, fileInfo] of Object.entries(importedFiles)) {
      if (existingSummary[id]) {
        updatedCount++;
      } else {
        newCount++;
      }
      existingSummary[id] = fileInfo;
    }
    
    // Save merged summary
    await chrome.storage.local.set({ downloadSummary: existingSummary });
    
    const totalCount = Object.keys(existingSummary).length;
    updateStatus(`✓ Imported ${newCount} new files, updated ${updatedCount}\nTotal in summary: ${totalCount} files`);
    
    // Update button text
    const totalSize = Object.values(existingSummary).reduce((sum, file) => sum + (file.file_size || 0), 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);
    exportSummaryBtn.textContent = `📥 Export Summary (${totalCount} files, ${totalSizeMB} MB)`;
    
  } catch (error) {
    updateStatus('❌ Error importing: ' + error.message);
  }
  
  // Reset file input
  event.target.value = '';
});

exportSummaryBtn.addEventListener('click', async () => {
  try {
    const result = await chrome.storage.local.get(['downloadSummary']);
    if (result.downloadSummary && Object.keys(result.downloadSummary).length > 0) {
      chrome.runtime.sendMessage({ action: 'exportSummary' });
      updateStatus('📥 Exporting download summary...');
    } else {
      updateStatus('ℹ️ No download history to export yet');
    }
  } catch (error) {
    updateStatus('❌ Error: ' + error.message);
  }
});

clearSummaryBtn.addEventListener('click', async () => {
  const confirmed = confirm('Are you sure you want to clear the download history?\n\nThis will remove the record of all downloaded files, and they may be downloaded again on the next run.\n\nConsider exporting the summary first!');
  if (confirmed) {
    try {
      await chrome.storage.local.set({ downloadSummary: {} });
      updateStatus('✓ Download history cleared');
    } catch (error) {
      updateStatus('❌ Error: ' + error.message);
    }
  }
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
