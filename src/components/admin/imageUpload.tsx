'use client'

import { useRef } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

type Props = {
  disabled: boolean
  onFileSelected: (file: File | null) => void
  file: File | null
}

/**
 * ImageUpload component
 * Handles drag-drop and file selection for webtoon images
 * Input: disabled state
 * Output: calls onFileSelected with File object
 */
export function ImageUpload({ 
  disabled, 
  onFileSelected,
  file 
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      validateAndSetFile(selectedFile)
    }
  }

  const validateAndSetFile = (selectedFile: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/webp']
    
    if (!validTypes.includes(selectedFile.type)) {
      alert('Please upload PNG, JPG, or WEBP files only')
      return
    }

    const maxSize = 10 * 1024 * 1024
    if (selectedFile.size > maxSize) {
      alert('File size must be less than 10MB')
      return
    }

    onFileSelected(selectedFile)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    
    if (disabled) return

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      validateAndSetFile(droppedFile)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return (
    <div className="space-y-2">
      <Label className={disabled ? 'text-muted-foreground' : ''}>
        Webtoon Screenshot
      </Label>

      {file ? (
        <div className="border rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFileSelected(null)}
              disabled={disabled}
            >
              Remove
            </Button>
          </div>

          <img
            src={URL.createObjectURL(file)}
            alt="Preview"
            className="max-h-64 mx-auto rounded"
          />
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={`
            border-2 border-dashed rounded-md p-8 
            text-center cursor-pointer
            transition-colors
            ${disabled 
              ? 'bg-muted border-muted cursor-not-allowed' 
              : 'hover:bg-muted/50 hover:border-primary'
            }
          `}
          onClick={() => {
            if (!disabled) {
              inputRef.current?.click()
            }
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            disabled={disabled}
            className="hidden"
          />
          
          <div className="space-y-2">
            <p className={
              disabled 
                ? 'text-muted-foreground' 
                : 'font-medium'
            }>
              {disabled 
                ? 'Complete above steps first' 
                : 'Drop image here or click to upload'
              }
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, or WEBP (max 10MB)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

