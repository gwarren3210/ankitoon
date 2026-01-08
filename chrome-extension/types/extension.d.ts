export interface ImageFile {
  file: File
  name: string
  path: string
}

export interface ScrapedImage {
  url: string
  name: string
}

export interface StitchResult {
  blob: Blob
  width: number
  height: number
  imageCount: number
}

// File System Access API types
declare global {
  interface FileSystemHandle {
    readonly kind: 'file' | 'directory'
    readonly name: string
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: 'file'
    getFile(): Promise<File>
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: 'directory'
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>
    values(): AsyncIterableIterator<FileSystemHandle>
    keys(): AsyncIterableIterator<string>
    getDirectoryHandle(
      name: string,
      options?: { create?: boolean }
    ): Promise<FileSystemDirectoryHandle>
    getFileHandle(
      name: string,
      options?: { create?: boolean }
    ): Promise<FileSystemFileHandle>
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
    resolve(
      possibleDescendant: FileSystemHandle
    ): Promise<string[] | null>
    isSameEntry(other: FileSystemHandle): Promise<boolean>
  }

  interface Window {
    showDirectoryPicker(options?: {
      mode?: 'read' | 'readwrite'
    }): Promise<FileSystemDirectoryHandle>
  }
}