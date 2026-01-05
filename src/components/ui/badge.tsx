import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        "state-new": "text-foreground",
        "state-learning": 
          "border-accent bg-accent/10 text-foreground hover:bg-accent/20",
        "state-review": 
          "border-transparent bg-accent text-accent-foreground hover:bg-accent/90",
        "state-relearning": 
          "border-accent/60 bg-accent/5 text-foreground hover:bg-accent/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

/**
 * Maps card state to badge variant.
 * Input: card state string
 * Output: state badge variant string
 */
export function getStateBadgeVariant(
  state?: 'New' | 'Learning' | 'Review' | 'Relearning'
): 'state-new' | 'state-learning' | 'state-review' | 'state-relearning' {
  switch (state) {
    case 'New':
      return 'state-new'
    case 'Learning':
      return 'state-learning'
    case 'Review':
      return 'state-review'
    case 'Relearning':
      return 'state-relearning'
    default:
      return 'state-new'
  }
}

export { Badge, badgeVariants }
