import type { ScrapedImage } from '../types/extension'

type SupportedDomain = 'kakao' | 'naver'

function getDomainFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return null
  }
}

function getSupportedDomain(hostname: string): SupportedDomain | null {
  if (hostname.includes('page.kakao.com')) {
    return 'kakao'
  }
  if (hostname.includes('m.comic.naver.com')) {
    return 'naver'
  }
  return null
}

function findImagesOnPage(patternStr: string): string[] {
  const pattern = new RegExp(patternStr, 'i')
  const foundImages: string[] = []

  document.querySelectorAll('img').forEach((img) => {
    if (pattern.test(img.src)) {
      foundImages.push(img.src)
    }
  })

  document.querySelectorAll('img[srcset]').forEach((img) => {
    const srcset = img.getAttribute('srcset')
    if (srcset) {
      const urls = srcset.split(',').map((s) => s.trim().split(' ')[0])
      urls.forEach((url) => {
        if (pattern.test(url)) {
          foundImages.push(url)
        }
      })
    }
  })

  document.querySelectorAll('*').forEach((el) => {
    const style = window.getComputedStyle(el)
    const bgImage = style.backgroundImage
    if (bgImage && bgImage !== 'none') {
      const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/)
      if (urlMatch && pattern.test(urlMatch[1])) {
        foundImages.push(urlMatch[1])
      }
    }
  })

  return [...new Set(foundImages)]
}

export async function scrapeImagesFromPage(): Promise<ScrapedImage[]> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  })

  if (!tab.id || !tab.url) {
    throw new Error('No active tab found')
  }

  const hostname = getDomainFromUrl(tab.url)
  if (!hostname) {
    throw new Error('Unable to determine page domain')
  }

  const domain = getSupportedDomain(hostname)
  if (!domain) {
    throw new Error(
      'This site is not supported. Supported sites: page.kakao.com and m.comic.naver.com'
    )
  }

  const patternStr =
    domain === 'kakao'
      ? 'sdownload\\/[^\\/]+'
      : 'mobilewebimg\\/[^\\/]+\\/[^\\/]+'

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: findImagesOnPage,
    args: [patternStr],
  })

  const urls = results[0].result as string[]

  return urls.map((url) => ({
    url,
    name: url.split('/').slice(-2).join('/'),
  }))
}

