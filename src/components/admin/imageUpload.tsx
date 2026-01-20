'use client'

import { useState, useRef } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export interface UploadedFileInfo {
  storagePath: string
  fileName: string
  fileSize: number
  fileType: string
}

type Props = {
  disabled: boolean
  onUploadComplete: (upload: UploadedFileInfo) => void
  onUploadStart?: () => void
  onUploadError?: (error: Error) => void
  uploadedFile: UploadedFileInfo | null
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

/**
 * ImageUpload component
 * Handles drag-drop, file selection, and direct upload to Supabase Storage
 * Input: disabled state, callbacks
 * Output: calls onUploadComplete with storage path and file info
 */
export function ImageUpload({
  disabled,
  onUploadComplete,
  onUploadStart,
  onUploadError,
  uploadedFile
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const supabase = createClient()

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`
    }

    // Check file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'application/zip']
    if (!validTypes.includes(file.type)) {
      return 'Invalid file type. Use PNG, JPG, WEBP, or ZIP'
    }

    return null
  }

  const handleUpload = async (file: File) => {
    // Validate
    const error = validateFile(file)
    if (error) {
      alert(error)
      return
    }

    setSelectedFile(file)
    setUploading(true)
    setUploadProgress(0)
    onUploadStart?.()

    // Create preview for images
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file))
    }

    try {
      // Upload to Supabase Storage
      const tempPath = `temp/${Date.now()}-${file.name}`

      const { data, error: uploadError } = await supabase.storage
        .from('admin-uploads')
        .upload(tempPath, file, {
          cacheControl: '3600',
          upsert: false,
          // Note: onUploadProgress not available in current Supabase client
          // Progress will jump from 0 to 100 when complete
        })

      if (uploadError) throw uploadError

      // Simulate progress for better UX
      setUploadProgress(100)

      // Notify parent
      onUploadComplete({
        storagePath: data.path,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      })

    } catch (error) {
      console.error('Upload failed:', error)
      const errorObj = error instanceof Error ? error : new Error('Upload failed')
      onUploadError?.(errorObj)
      alert(`Upload failed: ${errorObj.message}`)

      // Reset state
      setSelectedFile(null)
      setPreviewUrl(null)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()

    if (disabled || uploading) return

    const file = e.dataTransfer.files[0]
    if (file) {
      handleUpload(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleRemove = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
  }

  const isDisabled = disabled || uploading

  return (
    <div className="space-y-2">
      <Label className={isDisabled ? 'text-muted-foreground' : ''}>
        Webtoon Screenshot
      </Label>

      {uploadedFile ? (
        <div className="border rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{uploadedFile.fileName}</p>
              <p className="text-sm text-muted-foreground">
                {(uploadedFile.fileSize / 1024 / 1024).toFixed(2)} MB
                {uploadedFile.fileName.toLowerCase().endsWith('.zip') && ' (ZIP file)'}
              </p>
              <p className="text-xs text-green-600 mt-1">
                ✓ Uploaded successfully
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled}
            >
              Remove
            </Button>
          </div>

          {previewUrl && !uploadedFile.fileName.toLowerCase().endsWith('.zip') && (
            <Image
              src={previewUrl}
              alt="Preview"
              width={400}
              height={256}
              className="max-h-64 mx-auto rounded"
            />
          )}
        </div>
      ) : uploading ? (
        <div className="border rounded-md p-4 space-y-3">
          <div>
            <p className="font-medium">{selectedFile?.name}</p>
            <p className="text-sm text-muted-foreground">
              Uploading to storage...
            </p>
          </div>
          <Progress value={uploadProgress} className="w-full" />
          <p className="text-xs text-muted-foreground text-center">
            {uploadProgress === 0 ? 'Starting upload...' : `Upload complete!`}
          </p>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={`
            border-2 border-dashed rounded-md p-8
            text-center cursor-pointer
            transition-colors
            ${isDisabled
              ? 'bg-muted border-muted cursor-not-allowed'
              : 'hover:bg-muted/50 hover:border-primary'
            }
          `}
          onClick={() => {
            if (!isDisabled) {
              inputRef.current?.click()
            }
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,.zip"
            onChange={handleFileChange}
            disabled={isDisabled}
            className="hidden"
          />

          <div className="space-y-2">
            <p className={
              isDisabled
                ? 'text-muted-foreground'
                : 'font-medium'
            }>
              {disabled
                ? 'Complete above steps first'
                : 'Drop image or zip here or click to upload'
              }
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WEBP, or ZIP (max 50MB)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
