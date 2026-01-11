/**
 * Generic sorting utilities for type-safe, configurable array sorting.
 * Consolidates common sorting patterns used across library and browse pages.
 */

// ============================================================================
// Types
// ============================================================================

export type SortDirection = 'asc' | 'desc'

/**
 * Configuration for extracting and comparing values from items.
 */
export type SortConfig<T> = {
  getValue: (item: T) => string | number | Date | null | undefined
  nullBehavior?: 'start' | 'end'
}

/**
 * Sort option with embedded direction.
 */
export type SortOptionConfig<T> = SortConfig<T> & {
  direction: SortDirection
}

/**
 * Map of sort option keys to their configurations.
 */
export type SortOptionsMap<T, K extends string = string> = Record<
  K,
  SortOptionConfig<T>
>

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Sorts array using predefined option from a map.
 * Input: array, options map, selected option key
 * Output: new sorted array (original unchanged)
 */
export function sortByOption<T, K extends string>(
  items: T[],
  options: SortOptionsMap<T, K>,
  optionKey: K
): T[] {
  const option = options[optionKey]
  if (!option) return [...items]
  return sortBy(items, option, option.direction)
}

/**
 * Sorts array using sort configuration and direction.
 * Input: array, sort config, direction (default: desc)
 * Output: new sorted array (original unchanged)
 */
export function sortBy<T>(
  items: T[],
  config: SortConfig<T>,
  direction: SortDirection = 'desc'
): T[] {
  return [...items].sort(createComparator(config, direction))
}

/**
 * Creates comparator function from sort configuration.
 * Input: sort config, direction
 * Output: comparator function for Array.sort()
 */
export function createComparator<T>(
  config: SortConfig<T>,
  direction: SortDirection
): (a: T, b: T) => number {
  return (a: T, b: T) => {
    const aVal = config.getValue(a)
    const bVal = config.getValue(b)
    const comparison = compareValues(aVal, bVal, config.nullBehavior)
    return direction === 'asc' ? comparison : -comparison
  }
}

// ============================================================================
// Value Extraction Helpers
// ============================================================================

/**
 * Creates getValue function for date string fields.
 * Input: getter function, fallback for null (default: 0)
 * Output: getValue function returning timestamp
 */
export function dateValue<T>(
  getter: (item: T) => string | null | undefined,
  nullValue: number = 0
): (item: T) => number {
  return (item: T) => {
    const dateStr = getter(item)
    return dateStr ? new Date(dateStr).getTime() : nullValue
  }
}

/**
 * Creates getValue function for nullable numeric fields.
 * Input: getter function, fallback for null (default: 0)
 * Output: getValue function returning number
 */
export function numericValue<T>(
  getter: (item: T) => number | null | undefined,
  nullValue: number = 0
): (item: T) => number {
  return (item: T) => getter(item) ?? nullValue
}

/**
 * Creates getValue function for percentage calculations.
 * Input: numerator getter, denominator getter
 * Output: getValue function returning percentage (0 if denominator is 0 or null)
 */
export function percentValue<T>(
  getNumerator: (item: T) => number | null | undefined,
  getDenominator: (item: T) => number | null | undefined
): (item: T) => number {
  return (item: T) => {
    const numerator = getNumerator(item) ?? 0
    const denominator = getDenominator(item)
    return denominator ? numerator / denominator : 0
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Compares two values with type detection and null handling.
 * Input: two values, null behavior preference
 * Output: comparison result (-1, 0, or 1)
 */
function compareValues(
  aVal: string | number | Date | null | undefined,
  bVal: string | number | Date | null | undefined,
  nullBehavior?: 'start' | 'end'
): number {
  const aIsNull = aVal === null || aVal === undefined
  const bIsNull = bVal === null || bVal === undefined

  if (aIsNull && bIsNull) return 0
  if (aIsNull) return nullBehavior === 'start' ? -1 : 1
  if (bIsNull) return nullBehavior === 'start' ? 1 : -1

  if (aVal instanceof Date && bVal instanceof Date) {
    return aVal.getTime() - bVal.getTime()
  }

  if (typeof aVal === 'string' && typeof bVal === 'string') {
    return aVal.localeCompare(bVal)
  }

  return (aVal as number) - (bVal as number)
}
