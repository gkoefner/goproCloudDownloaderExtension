# GoPro Cloud Downloader Extension

A Chrome browser extension for bulk downloading all videos and photos from your GoPro Cloud account, with automatic resume capability and progress tracking.

## System Requirements

- **Browser:** Chrome or Chromium-based browsers (Edge, Brave, etc.) - Version 88+
- **Platform:** Chrome Browser Extension (Manifest V3)
- **Language:** JavaScript
- **API:** GoPro Cloud API (api.gopro.com)
- **Permissions:** downloads, storage, activeTab, scripting, notifications
- **Host permissions:** gopro.com, api.gopro.com
- **Prerequisites:** Active GoPro Cloud account with media files

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `gopro-extension` folder
5. Extension should appear in toolbar

## Usage

1. **Log in to GoPro Cloud**
   - Visit [gopro.com](https://gopro.com) and log into your account
   
2. **Open the Extension**
   - Click the extension icon in Chrome toolbar

3. **Select Download Folder**
   - Click "1. Select Download Folder"
   - Enter a subfolder name (e.g., "GoPro")
   - Files will be saved to `Downloads/[your-subfolder-name]/`

4. **Start Download**
   - Click "2. Start Download"
   - Watch progress in the popup
   - You can close the popup - downloads continue in background!

5. **Check Progress Anytime**
   - Reopen the popup to see current download status
   - Get a desktop notification when complete

## Features

### Core Functionality
✅ **Complete Library Access**: Downloads all accessible videos and photos from your GoPro Cloud  
✅ **Custom folder selection**: Downloads to user-specified subfolder in Downloads directory  
✅ **Background downloads**: Continues downloading even when popup is closed  
✅ **Sequential downloads**: 2-second delays between downloads to avoid server overload  
✅ **Progress tracking**: Real-time status updates showing percentage and file size  
✅ **Start/Stop controls**: User can pause/stop downloads at any time  
✅ **Metadata preservation**: Saves JSON metadata for each file (camera model, capture date, resolution, etc.)  
✅ **Desktop notifications**: Alerts you when all downloads complete  
✅ **Filtered content**: Automatically excludes JSON-only and MultiClipEdit types from download queue

### Smart Resume Feature

The extension automatically skips files you've already downloaded by checking:
- **Filename match** - Exact filename in the download folder
- **Filesize validation** - Ensures file size matches (within 1KB tolerance)
- **Auto re-download** - If file exists but size is wrong, it re-downloads

This means you can:
- Stop and restart downloads anytime
- Re-run on the same folder without re-downloading everything
- Recover from interrupted downloads automatically

## Extension Architecture

### File Structure
```
gopro-extension/
├── manifest.json          # Extension configuration (Manifest V3)
├── background.js          # Service worker with download logic
├── popup.html            # User interface
├── popup.js              # UI logic and event handlers
├── icon16.png            # 16x16 icon
├── icon48.png            # 48x48 icon
├── icon128.png           # 128x128 icon
└── README.md             # Extension documentation
```

### How It Works

1. **Media Discovery**
   - Queries GoPro Cloud API: `https://api.gopro.com/media/search`
   - Fetches all pages (100 items per page) using pagination
   - Filters for valid media types: Photo, Video, TimeLapse, Burst, etc.
   - Excludes: JSON files and MultiClipEdit types

2. **Sequential Downloads**
   - Downloads files one at a time (not all at once)
   - 2-second delay between downloads to prevent server overload
   - For each media item:
     - Requests download URL from `/media/{id}/download` endpoint
     - Downloads the source quality file using Chrome downloads API
     - Saves companion `.json` metadata file with full media information

3. **File Management**
   - Files saved to: `Downloads/[subfolder]/[original-filename]`
   - Metadata saved as: `Downloads/[subfolder]/[original-filename].json`
   - Uses `conflictAction: 'uniquify'` to prevent overwriting existing files
   - Chrome automatically appends `(1)`, `(2)`, etc. for duplicates

## Project History

### Initial Approach
- Started with JavaScript scripts (`gopro_dld.js`, `gopro-downloader-fixed.js`) that run in Chrome browser console
- **Issues encountered:**
  - Duplicate JSON metadata file downloads
  - Could not store files to a custom picked directory
  - Downloaded all files at once (no control over download process)

### Current Approach
- Developed `gopro-extension` Chrome browser extension
- Solved all original issues with proper Chrome extension architecture
- Added background processing, progress tracking, and smart resume capabilities

## Limitations

### Chrome Security Restrictions
- Cannot access arbitrary file system locations (File System Access API doesn't work in extension popups)
- Downloads must go to Chrome's default Downloads folder or subfolders within it
- Cannot programmatically change Chrome's default download location
- Chrome must remain open for downloads to continue (extension service worker requirement)

### API Limitations
- Download speed depends on GoPro Cloud API rate limits
- 2-second delay between requests is conservative to avoid throttling
- Requires active internet connection and GoPro Cloud session

## Troubleshooting

### Extension won't load
- Check that all icon files (icon16.png, icon48.png, icon128.png) are present
- Verify manifest.json is valid JSON

### "No download URL" errors
- Some media types may not have source URLs available
- The extension will skip these and continue with the next file

### Downloads not starting
- Ensure you're logged into gopro.com first
- Check Chrome's download permissions aren't blocking the extension
- Verify you have an active internet connection

### Progress stopped
- Check the status message for errors
- The extension may have encountered an API error - try clicking "Start Download" again

## Credits

This extension is based on the original console scripts by **lumberpete**:
- Original repository: https://github.com/lumberpete/goproMediaMassDownload
- Released under The Unlicense

Special thanks for providing the foundation and GoPro API interaction patterns that made this extension possible.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Future Enhancements

Potential improvements:
- [ ] Selective download filters (date range, media type, camera model)
- [ ] Concurrent downloads (configurable, e.g., 3 at a time)
- [ ] Export/import download history
- [ ] Direct integration with File System Access API (when Chrome supports it in extensions)
- [ ] Option to skip metadata JSON files
- [ ] Bandwidth throttling options

## Development

Built with assistance from Claude Sonnet 4.5 (Anthropic).

---
*Last updated: 2025-11-16*
