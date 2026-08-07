"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { usePresence } from "@/components/ui/floating"
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react"

type AccordionValue = string | string[] | undefined

type AccordionContextValue = {
  isOpen: (value: string) => boolean
  toggle: (value: string) => void
}

const AccordionContext = React.createContext<AccordionContextValue | null>(
  null
)

function useAccordionContext(component: string) {
  const context = React.useContext(AccordionContext)
  if (!context) {
    throw new Error(`${component} must be used within <Accordion>`)
  }
  return context
}

const AccordionItemContext = React.createContext<{
  value: string
  open: boolean
} | null>(null)

function useAccordionItemContext(component: string) {
  const context = React.useContext(AccordionItemContext)
  if (!context) {
    throw new Error(`${component} must be used within <AccordionItem>`)
  }
  return context
}

type AccordionSingleProps = React.HTMLAttributes<HTMLDivElement> & {
  type?: "single"
  collapsible?: boolean
  value?: string
  defaultValue?: string
  onValueChange?: (value: string | undefined) => void
}

type AccordionMultipleProps = React.HTMLAttributes<HTMLDivElement> & {
  type: "multiple"
  collapsible?: boolean
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
}

function Accordion(props: AccordionSingleProps): React.ReactElement
function Accordion(props: AccordionMultipleProps): React.ReactElement
function Accordion({
  type = "single",
  collapsible = false,
  value: valueProp,
  defaultValue,
  onValueChange,
  className,
  ...props
}: AccordionSingleProps | AccordionMultipleProps) {
  const [internalValue, setInternalValue] = React.useState<AccordionValue>(
    defaultValue ?? (type === "multiple" ? [] : undefined)
  )
  const value = valueProp ?? internalValue

  const setValue = React.useCallback(
    (next: AccordionValue) => {
      if (valueProp === undefined) setInternalValue(next)
      ;(onValueChange as ((value: AccordionValue) => void) | undefined)?.(next)
    },
    [valueProp, onValueChange]
  )

  const isOpen = React.useCallback(
    (item: string) => {
      if (type === "multiple") return Array.isArray(value) && value.includes(item)
      return value === item
    },
    [type, value]
  )

  const toggle = React.useCallback(
    (item: string) => {
      if (type === "multiple") {
        const current = Array.isArray(value) ? value : []
        const next = current.includes(item)
          ? current.filter((v) => v !== item)
          : [...current, item]
        setValue(next)
      } else if (value === item) {
        if (collapsible) setValue(undefined)
      } else {
        setValue(item)
      }
    },
    [type, value, collapsible, setValue]
  )

  return (
    <AccordionContext.Provider value={{ isOpen, toggle }}>
      <div
        data-slot="accordion"
        className={cn("flex w-full flex-col", className)}
        {...props}
      />
    </AccordionContext.Provider>
  )
}

function AccordionItem({
  className,
  value,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const { isOpen } = useAccordionContext("AccordionItem")
  const open = isOpen(value)

  return (
    <AccordionItemContext.Provider value={{ value, open }}>
      <div
        data-slot="accordion-item"
        data-state={open ? "open" : "closed"}
        className={cn("not-last:border-b", className)}
        {...props}
      />
    </AccordionItemContext.Provider>
  )
}

function AccordionTrigger({
  className,
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { toggle } = useAccordionContext("AccordionTrigger")
  const item = useAccordionItemContext("AccordionTrigger")

  return (
    <div className="flex">
      <button
        type="button"
        data-slot="accordion-trigger"
        aria-expanded={item.open}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented) return
          toggle(item.value)
        }}
        className={cn(
          "group/accordion-trigger relative flex flex-1 items-start justify-between gap-6 rounded-none border border-transparent py-4 text-left text-sm font-semibold transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-3.5 **:data-[slot=accordion-trigger-icon]:text-base-content/60",
          className
        )}
        {...props}
      >
        {children}
        <CaretDownIcon
          data-slot="accordion-trigger-icon"
          className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
        />
        <CaretUpIcon
          data-slot="accordion-trigger-icon"
          className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
        />
      </button>
    </div>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const item = useAccordionItemContext("AccordionContent")
  const mounted = usePresence(item.open, 200)
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const setHeight = () => {
      el.style.setProperty(
        "--radix-accordion-content-height",
        `${el.scrollHeight}px`
      )
    }
    setHeight()
    const observer = new ResizeObserver(setHeight)
    observer.observe(el)
    return () => observer.disconnect()
  }, [mounted, children])

  if (!mounted) return null

  return (
    <div
      ref={contentRef}
      data-slot="accordion-content"
      data-state={item.open ? "open" : "closed"}
      className="overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up"
    >
      <div
        className={cn(
          "pt-0 pb-4 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-base-content [&_p:not(:last-child)]:mb-4",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
