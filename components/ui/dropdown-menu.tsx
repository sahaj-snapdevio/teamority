"use client"

import * as React from "react"
import { CheckIcon, CaretRightIcon } from "@phosphor-icons/react"
import type { Placement } from "@floating-ui/dom"

import { cn } from "@/lib/utils"
import { Slot } from "@/components/ui/slot"
import { Portal, useFloatingPosition, useDismiss, usePresence } from "@/components/ui/floating"
import { useReturnFocusOnClose } from "@/components/ui/overlay"

type Side = "top" | "right" | "bottom" | "left"
type Align = "start" | "center" | "end"

function toPlacement(side: Side, align: Align): Placement {
  return align === "center" ? side : (`${side}-${align}` as Placement)
}

function focusableMenuItems(container: HTMLElement | null) {
  if (!container) return []
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      '[role^="menuitem"]:not([aria-disabled="true"])'
    )
  )
}

type DropdownMenuContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  contentRef: React.RefObject<HTMLElement | null>
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(
  null
)

function useDropdownMenuContext(component: string) {
  const context = React.useContext(DropdownMenuContext)
  if (!context) {
    throw new Error(`${component} must be used within <DropdownMenu>`)
  }
  return context
}

function DropdownMenu({
  open: openProp,
  defaultOpen,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false)
  const open = openProp ?? internalOpen
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const contentRef = React.useRef<HTMLElement | null>(null)

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange]
  )

  useReturnFocusOnClose(triggerRef, open)

  return (
    <DropdownMenuContext.Provider
      value={{ open, setOpen, triggerRef, contentRef }}
    >
      {children}
    </DropdownMenuContext.Provider>
  )
}

function DropdownMenuPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function DropdownMenuTrigger({
  asChild,
  onClick,
  children,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { open, setOpen, triggerRef } = useDropdownMenuContext(
    "DropdownMenuTrigger"
  )
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={triggerRef as React.Ref<HTMLButtonElement>}
      data-slot="dropdown-menu-trigger"
      type={asChild ? undefined : "button"}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        setOpen(!open)
      }}
      {...props}
    >
      {children}
    </Comp>
  )
}

function DropdownMenuContent({
  className,
  side = "bottom",
  align = "start",
  sideOffset = 4,
  onWheel,
  onKeyDown,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  side?: Side
  align?: Align
  sideOffset?: number
}) {
  const { open, setOpen, triggerRef, contentRef } = useDropdownMenuContext(
    "DropdownMenuContent"
  )
  const mounted = usePresence(open)
  const { referenceRef, floatingRef, styles, placement } = useFloatingPosition({
    open: mounted,
    placement: toPlacement(side, align),
    gap: sideOffset,
  })
  referenceRef.current = triggerRef.current

  useDismiss({ open, onOpenChange: setOpen, containerRefs: [triggerRef, contentRef] })

  React.useEffect(() => {
    if (!open) return
    const firstItem = focusableMenuItems(contentRef.current as HTMLElement)[0]
    firstItem?.focus()
  }, [open, contentRef])

  if (!mounted) return null

  const resolvedSide = placement.split("-")[0] as Side

  return (
    <Portal>
      <div
        ref={(node) => {
          contentRef.current = node
          floatingRef.current = node
        }}
        data-slot="dropdown-menu-content"
        data-state={open ? "open" : "closed"}
        data-side={resolvedSide}
        role="menu"
        style={styles}
        onWheel={(event) => {
          event.stopPropagation()
          onWheel?.(event)
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented) return
          const items = focusableMenuItems(contentRef.current as HTMLElement)
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
          } else if (event.key === "Tab") {
            setOpen(false)
          }
        }}
        className={cn(
          "z-50 max-h-[min(24rem,var(--available-height,24rem))] min-w-48 overflow-x-hidden overflow-y-auto rounded-xl bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </Portal>
  )
}

function DropdownMenuGroup({
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="dropdown-menu-group" role="group" {...props} />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  disabled,
  onClick,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean
  variant?: "default" | "destructive"
  disabled?: boolean
}) {
  const { setOpen } = useDropdownMenuContext("DropdownMenuItem")

  return (
    <div
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled}
      data-disabled={disabled ? "" : undefined}
      onClick={(event) => {
        if (disabled) return
        onClick?.(event)
        if (event.defaultPrevented) return
        setOpen(false)
      }}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !disabled) {
          event.preventDefault()
          ;(event.currentTarget as HTMLElement).click()
        }
      }}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium tracking-wider uppercase outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-9.5 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  disabled,
  onCheckedChange,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean
  checked?: boolean
  disabled?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  const { setOpen } = useDropdownMenuContext("DropdownMenuCheckboxItem")

  return (
    <div
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      role="menuitemcheckbox"
      aria-checked={checked}
      tabIndex={-1}
      aria-disabled={disabled}
      data-disabled={disabled ? "" : undefined}
      onClick={() => {
        if (disabled) return
        onCheckedChange?.(!checked)
        setOpen(false)
      }}
      className={cn(
        "relative flex cursor-default items-center gap-2.5 rounded-md py-2 pr-8 pl-3 text-xs font-medium tracking-wider uppercase outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-9.5 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        {checked && <CheckIcon />}
      </span>
      {children}
    </div>
  )
}

type DropdownMenuRadioGroupContextValue = {
  value?: string
  onValueChange?: (value: string) => void
}
const DropdownMenuRadioGroupContext =
  React.createContext<DropdownMenuRadioGroupContextValue | null>(null)

function DropdownMenuRadioGroup({
  value,
  onValueChange,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  value?: string
  onValueChange?: (value: string) => void
}) {
  return (
    <DropdownMenuRadioGroupContext.Provider value={{ value, onValueChange }}>
      <div data-slot="dropdown-menu-radio-group" role="group" {...props} />
    </DropdownMenuRadioGroupContext.Provider>
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  value,
  disabled,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean
  value: string
  disabled?: boolean
}) {
  const { setOpen } = useDropdownMenuContext("DropdownMenuRadioItem")
  const radioGroup = React.useContext(DropdownMenuRadioGroupContext)
  const checked = radioGroup?.value === value

  return (
    <div
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      role="menuitemradio"
      aria-checked={checked}
      tabIndex={-1}
      aria-disabled={disabled}
      data-disabled={disabled ? "" : undefined}
      onClick={() => {
        if (disabled) return
        radioGroup?.onValueChange?.(value)
        setOpen(false)
      }}
      className={cn(
        "relative flex cursor-default items-center gap-2.5 rounded-md py-2 pr-8 pl-3 text-xs font-medium tracking-wider uppercase outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-9.5 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        {checked && <CheckIcon />}
      </span>
      {children}
    </div>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-3 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase data-inset:pl-9.5",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dropdown-menu-separator"
      role="separator"
      aria-orientation="horizontal"
      className={cn("-mx-1.5 my-1.5 h-px bg-border/50", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

const DropdownMenuSubContext =
  React.createContext<DropdownMenuContextValue | null>(null)

function useDropdownMenuSubContext(component: string) {
  const context = React.useContext(DropdownMenuSubContext)
  if (!context) {
    throw new Error(`${component} must be used within <DropdownMenuSub>`)
  }
  return context
}

function DropdownMenuSub({
  open: openProp,
  onOpenChange,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = openProp ?? internalOpen
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const contentRef = React.useRef<HTMLElement | null>(null)

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange]
  )

  return (
    <DropdownMenuSubContext.Provider
      value={{ open, setOpen, triggerRef, contentRef }}
    >
      {children}
    </DropdownMenuSubContext.Provider>
  )
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  disabled,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean
  disabled?: boolean
}) {
  const { open, setOpen, triggerRef } = useDropdownMenuSubContext(
    "DropdownMenuSubTrigger"
  )

  return (
    <div
      ref={triggerRef as React.RefObject<HTMLDivElement>}
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      data-state={open ? "open" : "closed"}
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-disabled={disabled}
      tabIndex={-1}
      onClick={() => !disabled && setOpen(!open)}
      onMouseEnter={() => !disabled && setOpen(true)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" && !disabled) {
          event.preventDefault()
          setOpen(true)
        }
      }}
      className={cn(
        "flex cursor-default items-center gap-2 rounded-md px-3 py-2 text-xs font-medium tracking-wider uppercase outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-9.5 data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      {children}
      <CaretRightIcon className="ml-auto" />
    </div>
  )
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open, setOpen, triggerRef, contentRef } = useDropdownMenuSubContext(
    "DropdownMenuSubContent"
  )
  const mounted = usePresence(open)
  const { referenceRef, floatingRef, styles } = useFloatingPosition({
    open: mounted,
    placement: "right-start",
    gap: 2,
  })
  referenceRef.current = triggerRef.current

  useDismiss({ open, onOpenChange: setOpen, containerRefs: [triggerRef, contentRef] })

  if (!mounted) return null

  return (
    <Portal>
      <div
        ref={(node) => {
          contentRef.current = node
          floatingRef.current = node
        }}
        data-slot="dropdown-menu-sub-content"
        data-state={open ? "open" : "closed"}
        role="menu"
        style={styles}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            setOpen(false)
            ;(triggerRef.current as HTMLElement | null)?.focus()
          }
        }}
        className={cn(
          "z-50 min-w-36 overflow-hidden rounded-xl bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </Portal>
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
