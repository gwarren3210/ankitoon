'use client'

import { useState } from 'react'
import { AlertTriangle, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CardTypeFilterValue } from '@/lib/hooks/useCardTypeFilter'
import { cn } from '@/lib/utils'

interface FilterModalProps {
  currentFilter: CardTypeFilterValue
  onFilterChange: (value: CardTypeFilterValue) => void
  hasProgress: boolean
}

const FILTER_OPTIONS: {
  value: CardTypeFilterValue
  label: string
  description: string
}[] = [
  {
    value: 'all',
    label: 'Both',
    description: 'Words and grammar combined'
  },
  {
    value: 'vocabulary',
    label: 'Words only',
    description: 'Focus on vocabulary'
  },
  {
    value: 'grammar',
    label: 'Grammar only',
    description: 'Focus on grammar patterns'
  }
]

/**
 * Modal for changing the card type filter with progress warning.
 * Input: current filter, onChange handler, whether user has progress
 * Output: Button that opens modal with filter options and confirmation
 */
export function FilterModal({
  currentFilter,
  onFilterChange,
  hasProgress
}: FilterModalProps) {
  const [open, setOpen] = useState(false)
  const [selectedFilter, setSelectedFilter] =
    useState<CardTypeFilterValue>(currentFilter)

  // Reset selection when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setSelectedFilter(currentFilter)
    }
    setOpen(isOpen)
  }

  // Confirm filter change
  const handleConfirm = () => {
    if (selectedFilter !== currentFilter) {
      onFilterChange(selectedFilter)
    }
    setOpen(false)
  }

  // Get display label for current filter
  const currentLabel =
    FILTER_OPTIONS.find(opt => opt.value === currentFilter)?.label ?? 'Both'

  // Check if selection has changed
  const hasChanged = selectedFilter !== currentFilter

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          <span>{currentLabel}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Filter</DialogTitle>
          <DialogDescription>
            Select which card types to include in this session.
          </DialogDescription>
        </DialogHeader>

        {/* Warning alert - only shown when user has progress */}
        {hasProgress && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              Changing the filter will reset your progress in this session.
              Cards you&apos;ve already answered will need to be reviewed again.
            </AlertDescription>
          </Alert>
        )}

        {/* Filter options */}
        <div className="grid gap-2 py-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedFilter(option.value)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 text-left',
                'transition-colors hover:bg-accent',
                selectedFilter === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              )}
            >
              <div
                className={cn(
                  'mt-0.5 h-4 w-4 rounded-full border-2',
                  'flex items-center justify-center',
                  selectedFilter === option.value
                    ? 'border-primary'
                    : 'border-muted-foreground'
                )}
              >
                {selectedFilter === option.value && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
              <div className="grid gap-0.5">
                <span className="font-medium">{option.label}</span>
                <span className="text-sm text-muted-foreground">
                  {option.description}
                </span>
              </div>
            </button>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!hasChanged}
            variant={hasProgress && hasChanged ? 'destructive' : 'default'}
          >
            {hasProgress && hasChanged ? 'Reset & Change' : 'Change Filter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
