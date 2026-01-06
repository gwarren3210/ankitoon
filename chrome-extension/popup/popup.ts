import { scrapeImagesFromPage } from '../lib/imageScraper'
import { createZipFromImages } from '../lib/zipCreator'
import type { ScrapedImage } from '../types/extension'

let scrapedImages: ScrapedImage[] = []

const urlInput = document.getElementById('urlInput') as HTMLInputElement
const seriesInput = document.getElementById('seriesInput') as HTMLInputElement
const chapterInput = document.getElementById('chapterInput') as HTMLInputElement
const scanBtn = document.getElementById('scanBtn') as HTMLButtonElement
const folderStatus = document.getElementById('folderStatus') as HTMLParagraphElement
const imageListSection = document.getElementById('imageListSection') as HTMLDivElement
const imageList = document.getElementById('imageList') as HTMLDivElement
const imageCount = document.getElementById('imageCount') as HTMLSpanElement
const progressSection = document.getElementById('progressSection') as HTMLDivElement
const progressFill = document.getElementById('progressFill') as HTMLDivElement
const progressText = document.getElementById('progressText') as HTMLParagraphElement
const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement
const errorSection = document.getElementById('errorSection') as HTMLDivElement
const errorMessage = document.getElementById('errorMessage') as HTMLDivElement

function showError(message: string) {
  errorMessage.textContent = message
  errorSection.classList.remove('hidden')
  setTimeout(() => {
    errorSection.classList.add('hidden')
  }, 5000)
}

function hideError() {
  errorSection.classList.add('hidden')
}

function updateProgress(percent: number, text: string) {
  progressFill.style.width = `${percent}%`
  progressText.textContent = text
  progressSection.classList.remove('hidden')
}

function hideProgress() {
  progressSection.classList.add('hidden')
}

function renderImageList(images: ScrapedImage[]) {
  imageList.innerHTML = ''
  imageCount.textContent = images.length.toString()

  images.forEach((img, index) => {
    const item = document.createElement('div')
    item.className = 'image-item'

    const indexSpan = document.createElement('span')
    indexSpan.className = 'image-index'
    indexSpan.textContent = (index + 1).toString()

    const imgElement = document.createElement('img')
    imgElement.src = img.url
    imgElement.style.width = '40px'
    imgElement.style.height = '40px'
    imgElement.style.objectFit = 'cover'
    imgElement.style.borderRadius = '4px'
    imgElement.addEventListener('error', () => {
      imgElement.style.display = 'none'
    })

    const nameSpan = document.createElement('span')
    nameSpan.className = 'image-name'
    nameSpan.textContent = img.name

    item.appendChild(indexSpan)
    item.appendChild(imgElement)
    item.appendChild(nameSpan)
    imageList.appendChild(item)
  })
}

async function handleScanPage() {
  try {
    hideError()
    scanBtn.disabled = true
    folderStatus.textContent = 'Scanning page...'
    updateProgress(0, 'Scanning page for images...')

    const images = await scrapeImagesFromPage()
    scrapedImages = images

    if (images.length === 0) {
      folderStatus.textContent = 'No images found matching mobilewebimg/*/* or sdownload/* pattern'
      imageListSection.classList.add('hidden')
      downloadBtn.disabled = true
    } else {
      folderStatus.textContent = `Found ${images.length} images`
      renderImageList(images)
      imageListSection.classList.remove('hidden')
      downloadBtn.disabled = false
    }

    hideProgress()
    scanBtn.disabled = false
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    showError(`Failed to scan page: ${message}`)
    folderStatus.textContent = ''
    scanBtn.disabled = false
    hideProgress()
  }
}

function validateInputs(): boolean {
  if (!urlInput.value.trim()) {
    showError('Please enter the current URL')
    return false
  }
  if (!seriesInput.value.trim()) {
    showError('Please enter the series name')
    return false
  }
  if (!chapterInput.value.trim()) {
    showError('Please enter the chapter number')
    return false
  }
  return true
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function getZipFilename(): string {
  const series = sanitizeFilename(seriesInput.value.trim())
  const chapter = sanitizeFilename(chapterInput.value.trim())
  return `${series}-chapter-${chapter}.zip`
}

async function handleDownload() {
  if (scrapedImages.length === 0) {
    showError('No images to download')
    return
  }

  if (!validateInputs()) {
    return
  }

  try {
    hideError()
    downloadBtn.disabled = true
    updateProgress(0, 'Creating zip file...')

    const zipBlob = await createZipFromImages(scrapedImages)
    updateProgress(100, 'Zip file created')

    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = getZipFilename()
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setTimeout(() => {
      hideProgress()
    }, 1000)
    downloadBtn.disabled = false
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    showError(`Failed to download: ${message}`)
    hideProgress()
    downloadBtn.disabled = false
  }
}

async function initializePopup() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (tab.url) {
      urlInput.value = tab.url
    }
  } catch (error) {
    console.error('Failed to get current tab URL:', error)
  }
}

scanBtn.addEventListener('click', handleScanPage)
downloadBtn.addEventListener('click', handleDownload)

initializePopup()

