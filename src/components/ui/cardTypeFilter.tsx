'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CardTypeFilterValue } from '@/lib/hooks/useCardTypeFilter'

interface CardTypeFilterProps {
  value: CardTypeFilterValue
  onChange: (value: CardTypeFilterValue) => void
  disabled?: boolean
}

/**
 * Filter tabs for selecting card type (Words, Grammar, Both).
 * Uses Radix Tabs for accessible tab navigation.
 * Input: current value, onChange handler, optional disabled state
 * Output: Tab group for filtering by card type
 */
export function CardTypeFilter({
  value,
  onChange,
  disabled = false
}: CardTypeFilterProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as CardTypeFilterValue)}
    >
      <TabsList>
        <TabsTrigger value="all" disabled={disabled}>
          Both
        </TabsTrigger>
        <TabsTrigger value="vocabulary" disabled={disabled}>
          Words
        </TabsTrigger>
        <TabsTrigger value="grammar" disabled={disabled}>
          Grammar
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
