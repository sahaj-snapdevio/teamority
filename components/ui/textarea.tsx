import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "textarea field-sizing-content flex min-h-16 w-full resize-none rounded-md border border-base-300 bg-transparent text-base outline-none placeholder:text-base-content/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error aria-invalid:textarea-error md:text-sm dark:aria-invalid:border-error/50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
