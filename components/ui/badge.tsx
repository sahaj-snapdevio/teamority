import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Slot } from "@/components/ui/slot"

const badgeVariants = cva(
  "badge group/badge h-auto w-fit shrink-0 gap-1.5 overflow-hidden rounded-none border-0 bg-transparent px-0 py-0 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-0 has-data-[icon=inline-start]:pl-0 aria-invalid:border-error aria-invalid:ring-error/20 dark:aria-invalid:ring-error/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "text-base-content [a]:hover:text-base-content/70",
        secondary: "badge-secondary bg-transparent text-base-content/60 [a]:hover:text-base-content",
        destructive:
          "badge-error text-error focus-visible:ring-error/20 dark:focus-visible:ring-error/40 [a]:hover:text-error/70",
        outline: "badge-outline text-base-content [a]:hover:text-base-content/70",
        ghost: "text-base-content/60 hover:text-base-content",
        link: "text-base-content underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
