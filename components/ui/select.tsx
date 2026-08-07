"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Portal, useFloatingPosition, useDismiss, usePresence } from "@/components/ui/floating"
import { useReturnFocusOnClose } from "@/components/ui/overlay"
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react"

function focusableOptions(container: HTMLElement | null) {
  if (!container) return []
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      '[role="option"]:not([aria-disabled="true"])'
    )
  )
}

type SelectContextValue = {
  value?: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  contentRef: React.RefObject<HTMLElement | null>
  disabled?: boolean
  registerLabel: (value: string, label: React.ReactNode) => void
  labels: Map<string, React.ReactNode>
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext(component: string) {
  const context = React.useContext(SelectContext)
  if (!context) {
    throw new Error(`${component} must be used within <Select>`)
  }
  return context
}

function Select({
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen,
  onOpenChange,
  disabled,
  children,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  children?: React.ReactNode
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const value = valueProp ?? internalValue
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false)
  const open = openProp ?? internalOpen
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const contentRef = React.useRef<HTMLElement | null>(null)
  const labelsRef = React.useRef<Map<string, React.ReactNode>>(new Map())
  const [, forceUpdate] = React.useReducer((count: number) => count + 1, 0)

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (disabled) return
      if (openProp === undefined) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [disabled, openProp, onOpenChange]
  )

  const handleValueChange = React.useCallback(
    (next: string) => {
      if (valueProp === undefined) setInternalValue(next)
      onValueChange?.(next)
    },
    [valueProp, onValueChange]
  )

  const registerLabel = React.useCallback(
    (itemValue: string, label: React.ReactNode) => {
      const isNew = !labelsRef.current.has(itemValue)
      labelsRef.current.set(itemValue, label)
      if (isNew) forceUpdate()
    },
    []
  )

  useReturnFocusOnClose(triggerRef, open)

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange: handleValueChange,
        open,
        setOpen,
        triggerRef,
        contentRef,
        disabled,
        registerLabel,
        labels: labelsRef.current,
      }}
    >
      {children}
    </SelectContext.Provider>
  )
}

function SelectGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="select-group"
      role="group"
      className={cn("scroll-my-1.5 p-1.5", className)}
      {...props}
    />
  )
}

function SelectValue({
  placeholder,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { placeholder?: React.ReactNode }) {
  const { value, labels } = useSelectContext("SelectValue")
  const label = value !== undefined ? labels.get(value) : undefined

  return (
    <span data-slot="select-value" className={className} {...props}>
      {label ?? placeholder}
    </span>
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: "sm" | "default" }) {
  const { open, setOpen, triggerRef, disabled: contextDisabled } =
    useSelectContext("SelectTrigger")
  const isDisabled = disabled ?? contextDisabled

  return (
    <button
      ref={triggerRef as React.Ref<HTMLButtonElement>}
      type="button"
      data-slot="select-trigger"
      data-size={size}
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      disabled={isDisabled}
      onClick={() => setOpen(!open)}
      onKeyDown={(event) => {
        if (isDisabled) return
        if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          setOpen(true)
        }
      }}
      className={cn(
        "select flex w-fit justify-between rounded-md border border-base-300 bg-none bg-transparent px-3 py-2 text-sm transition-[color,border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error data-placeholder:text-base-content/60 data-[size=default]:h-10 data-[size=sm]:h-9 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:aria-invalid:border-error/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      {children}
      <CaretDownIcon className="pointer-events-none size-3.5 text-base-content/60" />
    </button>
  )
}

function SelectContent({
  className,
  children,
  onWheel,
  align = "start",
  position: _position,
  sideOffset = 4,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "center" | "end"
  /** Accepted for API compatibility; this implementation always behaves like Radix's "popper" mode. */
  position?: "popper" | "item-aligned"
  sideOffset?: number
}) {
  const { open, setOpen, triggerRef, contentRef } = useSelectContext(
    "SelectContent"
  )
  // usePresence rather than a local useEffect-driven flag: its entry
  // transition runs in a useLayoutEffect, so `visible` flips before paint
  // instead of a frame later.
  const visible = usePresence(open)
  const placement =
    align === "center" ? "bottom" : align === "end" ? "bottom-end" : "bottom-start"
  const { referenceRef, floatingRef, styles } = useFloatingPosition({
    open: visible,
    placement,
    gap: sideOffset,
    matchReferenceWidth: true,
  })
  referenceRef.current = triggerRef.current

  useDismiss({ open, onOpenChange: setOpen, containerRefs: [triggerRef, contentRef] })

  React.useEffect(() => {
    if (!open) return
    const container = contentRef.current as HTMLElement | null
    const selected = container?.querySelector<HTMLElement>(
      '[role="option"][aria-selected="true"]'
    )
    const first = focusableOptions(container)[0]
    ;(selected ?? first)?.focus()
  }, [open, contentRef])

  return (
    <Portal>
      <div
        ref={(node) => {
          contentRef.current = node
          floatingRef.current = node
        }}
        data-slot="select-content"
        data-state={open ? "open" : "closed"}
        role="listbox"
        aria-hidden={!visible}
        inert={!visible}
        style={{
          ...styles,
          // AND with styles.visibility rather than overwriting it:
          // useFloatingPosition reports "hidden" until it has a real computed
          // position, so the un-positioned 0,0 fallback is never painted.
          // Unlike Popover/DropdownMenu, SelectContent stays mounted while
          // closed, so it can reach a render with `visible` true but no
          // position yet — forcing "visible" here would expose exactly that.
          visibility:
            visible && styles.visibility !== "hidden" ? "visible" : "hidden",
          pointerEvents: visible ? "auto" : "none",
        }}
        onWheel={(event) => {
          event.stopPropagation()
          onWheel?.(event)
        }}
        onKeyDown={(event) => {
          const container = contentRef.current as HTMLElement | null
          const items = focusableOptions(container)
          const currentIndex = items.indexOf(
            document.activeElement as HTMLElement
          )
          if (event.key === "ArrowDown") {
            event.preventDefault()
            items[(currentIndex + 1 + items.length) % items.length]?.focus()
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            items[(currentIndex - 1 + items.length) % items.length]?.focus()
          } else if (event.key === "Home") {
            event.preventDefault()
            items[0]?.focus()
          } else if (event.key === "End") {
            event.preventDefault()
            items[items.length - 1]?.focus()
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            ;(document.activeElement as HTMLElement | null)?.click()
          } else if (event.key === "Tab") {
            setOpen(false)
          }
        }}
        className={cn(
          "relative z-50 min-w-36 overflow-x-hidden overflow-y-auto rounded-xl bg-elevated text-base-content shadow-md ring-1 ring-base-content/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="select-label"
      className={cn(
        "px-3 py-2 text-xs font-semibold tracking-wider text-base-content/60 uppercase",
        className
      )}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  value,
  disabled,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string; disabled?: boolean }) {
  const { value: selectedValue, onValueChange, setOpen, registerLabel } =
    useSelectContext("SelectItem")
  const checked = selectedValue === value

  React.useEffect(() => {
    registerLabel(value, children)
  }, [value, children, registerLabel])

  return (
    <div
      data-slot="select-item"
      role="option"
      aria-selected={checked}
      aria-disabled={disabled}
      data-disabled={disabled ? "" : undefined}
      tabIndex={-1}
      onClick={() => {
        if (disabled) return
        onValueChange(value)
        setOpen(false)
      }}
      className={cn(
        "relative flex w-full cursor-default items-center gap-2.5 rounded-md py-2 pr-8 pl-3 text-sm outline-hidden select-none focus:bg-base-200 focus:text-base-content data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        {checked && <CheckIcon className="pointer-events-none" />}
      </span>
      <span>{children}</span>
    </div>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="select-separator"
      role="separator"
      aria-orientation="horizontal"
      className={cn("pointer-events-none -mx-1.5 my-1.5 h-px bg-base-300/50", className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
