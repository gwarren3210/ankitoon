# Chrome Extension Image Stitcher

Chrome extension that reads images from a nested folder structure (`mobilewebimg/*/*`), stitches them vertically, and provides download functionality.

## Features

- Read images from folder structure matching `mobilewebimg/*/*` pattern
- Stitch images vertically maintaining aspect ratios
- Download stitched image as PNG
- Extensible backend API integration (ready for Next.js backend calls)

## Development

### Prerequisites

- Bun (or Node.js with TypeScript)
- Chrome browser

### Building

1. Run the build script:
```bash
cd chrome-extension
chmod +x build.sh
./build.sh
```

Or manually compile TypeScript files using bun:
```bash
bun build popup/popup.ts --outdir dist/popup --target browser --format esm
bun build background/background.ts --outdir dist/background --target browser --format esm
# ... compile other files
```

2. Load the extension:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` directory

### Project Structure

```
chrome-extension/
├── manifest.json          # Extension manifest
├── background/           # Service worker
├── popup/                 # Popup UI (HTML, CSS, TS)
├── lib/                   # Core logic (file reading, stitching, API)
├── config/                # Configuration (API URLs)
└── types/                 # TypeScript definitions
```

## Usage

1. Click the extension icon
2. Click "Select Folder" and choose a folder containing `mobilewebimg` subdirectories
3. Review the list of found images
4. Click "Stitch Images" to combine them vertically
5. Click "Download" to save the stitched image

## Backend Integration

The extension includes an API client (`lib/apiClient.ts`) ready for integration with the Next.js backend. Configure the backend URL in `config/apiConfig.ts`.

Example usage:
```typescript
import { apiRequestFormData } from '../lib/apiClient'

const formData = new FormData()
formData.append('image', imageBlob)
formData.append('seriesSlug', 'example')
formData.append('chapterNumber', '1')

const result = await apiRequestFormData('/api/admin/process-image', formData)
```

## Technical Notes

- Uses Chrome File System Access API (requires user interaction)
- Canvas API for image stitching
- ES modules for code organization
- Manifest V3 format

