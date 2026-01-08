const getBackendUrl = (): string => {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return 'http://localhost:3000'
  }
  return 'http://localhost:3000'
}

export const apiConfig = {
  baseUrl: getBackendUrl(),
  timeout: 30000,
}

export function getApiUrl(endpoint: string): string {
  const base = apiConfig.baseUrl.replace(/\/$/, '')
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${base}${path}`
}

