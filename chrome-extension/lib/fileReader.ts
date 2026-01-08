import { ImageFile } from '../types/extension'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// Extended FileSystemHandle types for File System Access API
interface ExtendedFileSystemHandle {
  readonly kind: 'file' | 'directory'
  readonly name: string
}

interface ExtendedFileSystemFileHandle extends ExtendedFileSystemHandle {
  readonly kind: 'file'
  getFile(): Promise<File>
}

interface ExtendedFileSystemDirectoryHandle extends ExtendedFileSystemHandle {
  readonly kind: 'directory'
  entries(): AsyncIterableIterator<[string, ExtendedFileSystemHandle]>
}

function isImageFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))
}

function naturalSort(a: string, b: string): number {
  const aParts = a.match(/(\d+|\D+)/g) || []
  const bParts = b.match(/(\d+|\D+)/g) || []
  const maxLength = Math.max(aParts.length, bParts.length)

  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] || ''
    const bPart = bParts[i] || ''
    const aNum = parseInt(aPart, 10)
    const bNum = parseInt(bPart, 10)

    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) {
        return aNum - bNum
      }
    } else {
      const comparison = aPart.localeCompare(bPart, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
      if (comparison !== 0) {
        return comparison
      }
    }
  }
  return 0
}

async function readDirectoryRecursive(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string = '',
  targetPattern?: string[]
): Promise<ImageFile[]> {
  const images: ImageFile[] = []
  const pathParts = basePath.split('/').filter(Boolean)

  if (targetPattern && targetPattern.length > 0) {
    const currentLevel = pathParts.length
    if (currentLevel < targetPattern.length) {
      const expectedDir = targetPattern[currentLevel]
      if (expectedDir !== '*' && dirHandle.name !== expectedDir) {
        return images
      }
    }
  }

  const extendedHandle = dirHandle as unknown as ExtendedFileSystemDirectoryHandle
  for await (const [name, entry] of extendedHandle.entries()) {
    const entryPath = basePath ? `${basePath}/${name}` : name

    if (entry.kind === 'file') {
      const fileHandle = entry as ExtendedFileSystemFileHandle
      const file = await fileHandle.getFile()
      if (isImageFile(file) && file.size <= MAX_FILE_SIZE) {
        images.push({
          file,
          name,
          path: entryPath,
        })
      }
    } else if (entry.kind === 'directory') {
      const subDirHandle = entry as ExtendedFileSystemDirectoryHandle
      const subImages = await readDirectoryRecursive(
        subDirHandle as unknown as FileSystemDirectoryHandle,
        entryPath,
        targetPattern
      )
      images.push(...subImages)
    }
  }

  return images
}

export async function selectFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('File System Access API not supported')
  }

  try {
    const dirHandle = await window.showDirectoryPicker({
      mode: 'read',
    })
    return dirHandle
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return null
    }
    throw error
  }
}

export async function readImagesFromFolder(
  dirHandle: FileSystemDirectoryHandle,
  pattern?: string[]
): Promise<ImageFile[]> {
  const images = await readDirectoryRecursive(dirHandle, '', pattern)
  images.sort((a, b) => naturalSort(a.path, b.path))
  return images
}

export async function readImagesFromMobileWebImg(
  dirHandle: FileSystemDirectoryHandle
): Promise<ImageFile[]> {
  return readImagesFromFolder(dirHandle, ['mobilewebimg', '*', '*'])
}

