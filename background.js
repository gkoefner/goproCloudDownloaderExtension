let isDownloading = false;
let downloadQueue = [];
let currentIndex = 0;
let downloadFolder = '';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startDownload') {
    downloadFolder = message.folder;
    startDownload();
  } else if (message.action === 'stopDownload') {
    isDownloading = false;
    downloadQueue = [];
    currentIndex = 0;
    chrome.storage.local.set({ isDownloading: false });
  }
});

async function startDownload() {
  isDownloading = true;
  downloadQueue = [];
  currentIndex = 0;
  
  // Save download state
  await chrome.storage.local.set({ isDownloading: true });
  
  try {
    // Fetch all pages of media
    sendStatus('🔍 Fetching media list...');
    const allMedia = await fetchAllMedia();
    
    sendStatus(`✓ Found ${allMedia.length} items`);
    
    // Filter for videos/photos only
    downloadQueue = allMedia.filter(clip => 
      clip.filename && 
      clip.file_extension && 
      !['json'].includes(clip.file_extension) &&
      !['MultiClipEdit'].includes(clip.type)
    );
    
    sendStatus(`📥 Starting download of ${downloadQueue.length} files...`);
    
    // Start downloading
    downloadNext();
    
  } catch (error) {
    sendError('Failed to fetch media: ' + error.message);
  }
}

async function fetchAllMedia() {
  let allMedia = [];
  let page = 1;
  let totalPages = 1;
  
  while (page <= totalPages) {
    const response = await fetch(
      `https://api.gopro.com/media/search?processing_states=rendering,pretranscoding,transcoding,ready&fields=camera_model,captured_at,content_title,content_type,created_at,gopro_user_id,gopro_media,filename,file_extension,file_size,height,fov,id,item_count,mce_type,moments_count,on_public_profile,orientation,play_as,ready_to_edit,ready_to_view,resolution,source_duration,token,type,width,submitted_at,thumbnail_available,captured_at_timezone,available_labels&type=Burst,BurstVideo,Continuous,LoopedVideo,Photo,TimeLapse,TimeLapseVideo,Video,MultiClipEdit&page=${page}&per_page=100`,
      {
        headers: {
          "accept": "application/vnd.gopro.jk.media.search+json; version=2.0.0",
          "accept-language": "en-US,en;q=0.9",
        },
        credentials: "include"
      }
    );
    
    const data = await response.json();
    
    if (data && data._embedded && data._embedded.media) {
      allMedia = allMedia.concat(data._embedded.media);
      totalPages = data._pages?.total_pages || 1;
      sendStatus(`📄 Fetched page ${page}/${totalPages}`);
    }
    
    page++;
  }
  
  return allMedia;
}

async function downloadNext() {
  console.log(`[DEBUG] downloadNext called - isDownloading: ${isDownloading}, currentIndex: ${currentIndex}, queueLength: ${downloadQueue.length}`);
  
  if (!isDownloading || currentIndex >= downloadQueue.length) {
    const totalSizeMB = downloadQueue.reduce((sum, clip) => sum + (clip.file_size || 0), 0) / (1024 * 1024);
    await chrome.storage.local.set({ isDownloading: false });
    sendComplete(`✅ Download complete! ${currentIndex} files (${totalSizeMB.toFixed(1)} MB) downloaded to Downloads/${downloadFolder}`);
    
    console.log('[DEBUG] All downloads complete');
    
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon128.png',
      title: 'GoPro Download Complete',
      message: `${currentIndex} files (${totalSizeMB.toFixed(1)} MB) downloaded successfully!`
    });
    return;
  }
  
  const clip = downloadQueue[currentIndex];
  const remaining = downloadQueue.length - currentIndex;
  const fileSizeMB = clip.file_size ? (clip.file_size / (1024 * 1024)).toFixed(1) : '?';
  const estimatedMinutes = Math.round((remaining * 2) / 60); // Rough estimate based on 2s delay per file
  
  console.log(`[DEBUG] Starting download ${currentIndex + 1}/${downloadQueue.length}: ${clip.filename}`);
  sendStatus(`[${currentIndex + 1}/${downloadQueue.length}] ${clip.filename} (${fileSizeMB} MB) - Est: ${estimatedMinutes}min remaining`);
  
  try {
    // Get download URL
    const response = await fetch(
      `https://api.gopro.com/media/${clip.id}/download`,
      {
        headers: {
          "accept": "application/vnd.gopro.jk.media.search+json; version=2.0.0",
        },
        credentials: "include"
      }
    );
    
    const data = await response.json();
    const downloadInfo = data._embedded?.variations?.find(v => v.label === "source");
    
    if (downloadInfo && downloadInfo.url) {
      console.log(`[DEBUG] Got download URL for ${clip.filename}`);
      
      // Check if file already exists by searching download history
      const existingDownloads = await chrome.downloads.search({
        filenameRegex: `${downloadFolder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${clip.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        exists: true
      });
      
      // Verify file exists with matching size
      if (existingDownloads && existingDownloads.length > 0) {
        const existingFile = existingDownloads[0];
        const expectedSize = clip.file_size;
        
        // Check if file size matches (within 1KB tolerance for metadata differences)
        if (expectedSize && existingFile.fileSize && Math.abs(existingFile.fileSize - expectedSize) < 1024) {
          console.log(`[DEBUG] File already exists with matching size, skipping: ${clip.filename} (${existingFile.fileSize} bytes)`);
          sendStatus(`[${currentIndex + 1}/${downloadQueue.length}] ⏭️ Skipping ${clip.filename} (already exists, ${(existingFile.fileSize / (1024 * 1024)).toFixed(1)} MB)`);
          currentIndex++;
          setTimeout(downloadNext, 500);
          return;
        } else if (existingFile.fileSize) {
          console.log(`[DEBUG] File exists but size mismatch - Expected: ${expectedSize}, Found: ${existingFile.fileSize}, re-downloading: ${clip.filename}`);
          sendStatus(`[${currentIndex + 1}/${downloadQueue.length}] ⚠️ Re-downloading ${clip.filename} (size mismatch)`);
        }
      }
      
      // Start tracking download for progress
      const downloadId = await chrome.downloads.download({
        url: downloadInfo.url,
        filename: `${downloadFolder}/${clip.filename}`,
        conflictAction: 'uniquify'
      });
      
      console.log(`[DEBUG] Download started with ID: ${downloadId}`);
      
      // Wait for download to complete with progress tracking
      await new Promise((resolve) => {
        let lastProgress = 0;
        
        const checkProgress = async () => {
          try {
            const results = await chrome.downloads.search({id: downloadId});
            
            if (!results || results.length === 0) {
              // Download not found, might have completed already
              resolve();
              return;
            }
            
            const download = results[0];
            
            if (download.state === 'complete') {
              console.log(`[DEBUG] Download complete: ${clip.filename}`);
              resolve();
            } else if (download.state === 'interrupted') {
              console.log(`[DEBUG] Download interrupted: ${clip.filename}`);
              sendStatus(`❌ Download interrupted: ${clip.filename}`);
              resolve();
            } else if (download.state === 'in_progress') {
              // Still downloading, show progress
              const percent = download.totalBytes > 0 
                ? Math.round((download.bytesReceived / download.totalBytes) * 100)
                : 0;
              
              // Update if progress changed by at least 5%
              if (percent - lastProgress >= 5 || percent === 100) {
                lastProgress = percent;
                const receivedMB = (download.bytesReceived / (1024 * 1024)).toFixed(1);
                const totalMB = (download.totalBytes / (1024 * 1024)).toFixed(1);
                sendStatus(`[${currentIndex + 1}/${downloadQueue.length}] ${clip.filename} - ${percent}% (${receivedMB}/${totalMB} MB)`);
              }
              
              // Check again in 500ms
              setTimeout(checkProgress, 500);
            } else {
              // Unknown state, check again
              setTimeout(checkProgress, 500);
            }
          } catch (error) {
            console.error('Error checking progress:', error);
            setTimeout(checkProgress, 500);
          }
        };
        
        // Start checking progress after a short delay
        setTimeout(checkProgress, 500);
      });
      
      // Download completed, now save metadata JSON
      const jsonContent = JSON.stringify(clip, null, 2);
      const jsonDataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonContent);
      
      await chrome.downloads.download({
        url: jsonDataUrl,
        filename: `${downloadFolder}/${clip.filename}.json`,
        conflictAction: 'uniquify'
      });
      
      // Wait a bit before next download
      console.log(`[DEBUG] Moving to next file. Current: ${currentIndex}, Next: ${currentIndex + 1}`);
      currentIndex++;
      setTimeout(downloadNext, 2000);
      
    } else {
      console.log(`[DEBUG] No download URL for ${clip.filename}`);
      sendStatus(`⚠️ No download URL for ${clip.filename}, skipping...`);
      currentIndex++;
      downloadNext();
    }
    
  } catch (error) {
    console.error(`[DEBUG] Error downloading ${clip.filename}:`, error);
    sendStatus(`❌ Error downloading ${clip.filename}: ${error.message}`);
    currentIndex++;
    setTimeout(downloadNext, 2000);
  }
}



function sendStatus(text) {
  // Save status to storage so popup can retrieve it
  chrome.storage.local.set({ lastStatus: text });
  // Also try to send to popup if it's open
  chrome.runtime.sendMessage({ type: 'status', text }).catch(() => {
    // Popup not open, that's okay
  });
}

function sendComplete(text) {
  chrome.runtime.sendMessage({ type: 'complete', text });
  chrome.runtime.sendMessage({ type: 'status', text });
}

function sendError(text) {
  chrome.runtime.sendMessage({ type: 'error', text });
}
