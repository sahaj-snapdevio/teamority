"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type RadioGroupContextValue = {
  name: string
  value?: string
  disabled?: boolean
  onValueChange?: (value: string) => void
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
  null
)

let radioGroupIdCounter = 0

function RadioGroup({
  className,
  value,
  defaultValue,
  onValueChange,
  disabled,
  name,
  ...props
}: React.ComponentProps<"div"> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  name?: string
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const groupName = React.useState(
    () => name ?? `radio-group-${++radioGroupIdCounter}`
  )[0]
  const currentValue = value ?? internalValue

  const handleValueChange = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternalValue(next)
      onValueChange?.(next)
    },
    [value, onValueChange]
  )

  return (
    <RadioGroupContext.Provider
      value={{
        name: groupName,
        value: currentValue,
        disabled,
        onValueChange: handleValueChange,
      }}
    >
      <div
        data-slot="radio-group"
        role="radiogroup"
        className={cn("grid w-full gap-3", className)}
        {...props}
      />
    </RadioGroupContext.Provider>
  )
}

function RadioGroupItem({
  className,
  value,
  id,
  disabled,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "value"> & { value: string }) {
  const context = React.useContext(RadioGroupContext)
  if (!context) {
    throw new Error("RadioGroupItem must be used within a RadioGroup")
  }
  const checked = context.value === value
  const isDisabled = disabled ?? context.disabled

  return (
    <span
      data-slot="radio-group-item"
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "group/radio-group-item peer relative flex aspect-square size-4.5 shrink-0 rounded-full border border-input bg-transparent outline-none has-[:focus-visible]:border-ring has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/30 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[[aria-invalid]]:border-destructive has-[[aria-invalid]]:ring-2 has-[[aria-invalid]]:ring-destructive/20 data-[state=checked]:border-foreground",
        className
      )}
    >
      <input
        type="radio"
        id={id}
        name={context.name}
        value={value}
        checked={checked}
        disabled={isDisabled}
        onChange={() => context.onValueChange?.(value)}
        className="absolute -inset-x-3 -inset-y-2 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      {checked && (
        <span
          data-slot="radio-group-indicator"
          className="pointer-events-none flex size-4.5 items-center justify-center"
        >
          <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
        </span>
      )}
    </span>
  )
}

export { RadioGroup, RadioGroupItem }
