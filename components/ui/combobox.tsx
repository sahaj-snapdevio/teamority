"use client"

import * as React from "react"
import {
  Combobox as HeadlessCombobox,
  ComboboxInput as HeadlessComboboxInput,
  ComboboxOptions as HeadlessComboboxOptions,
  ComboboxOption as HeadlessComboboxOption,
} from "@headlessui/react"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

/**
 * Replaces the old cmdk-based Command primitive — removed to drop the last
 * radix-ui dependency (cmdk pulls in @radix-ui/react-dialog and friends
 * internally). Headless UI has no Radix dependency of its own.
 *
 * Headless UI's `<Combobox>` root renders as a Fragment by default (no DOM
 * node of its own — it's meant to wrap sibling input/options elements you
 * position yourself), so the bordered container here is a real wrapping
 * `<div>`, not a prop on the root.
 */
function Combobox<TValue>({
  className,
  children,
  ...props
}: React.ComponentProps<typeof HeadlessCombobox<TValue, false>> & {
  className?: string
}) {
  return (
    <div
      data-slot="combobox"
      className={cn(
        "flex flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground",
        className
      )}
    >
      <HeadlessCombobox {...props}>{children}</HeadlessCombobox>
    </div>
  )
}

function ComboboxInput({
  className,
  ...props
}: React.ComponentProps<typeof HeadlessComboboxInput<string>>) {
  return (
    <div
      data-slot="combobox-input-wrapper"
      className="flex items-center gap-2 border-b px-3"
    >
      <HeadlessComboboxInput
        data-slot="combobox-input"
        className={cn(
          "w-full bg-transparent py-2.5 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      <MagnifyingGlassIcon className="size-3.5 shrink-0 opacity-50" />
    </div>
  )
}

function ComboboxOptions({
  className,
  ...props
}: React.ComponentProps<typeof HeadlessComboboxOptions>) {
  return (
    <HeadlessComboboxOptions
      data-slot="combobox-options"
      className={cn(
        "no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none",
        className
      )}
      {...props}
    />
  )
}

function ComboboxEmpty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="combobox-empty"
      className={cn("py-6 text-center text-sm", className)}
      {...props}
    />
  )
}

function ComboboxGroup({
  heading,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { heading?: React.ReactNode }) {
  return (
    <div
      data-slot="combobox-group"
      className={cn("overflow-hidden p-1.5 text-foreground", className)}
      {...props}
    >
      {heading && (
        <div className="px-3 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {heading}
        </div>
      )}
      {children}
    </div>
  )
}

function ComboboxOption<TValue>({
  className,
  children,
  ...props
}: React.ComponentProps<typeof HeadlessComboboxOption<"div", TValue>> & {
  className?: string
}) {
  return (
    <HeadlessComboboxOption
      data-slot="combobox-option"
      className={(bag) =>
        cn(
          "relative flex cursor-default items-center gap-2 rounded-md px-3 py-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
          bag.focus && "bg-muted text-foreground",
          className
        )
      }
      {...props}
    >
      {children}
    </HeadlessComboboxOption>
  )
}

export {
  Combobox,
  ComboboxInput,
  ComboboxOptions,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxOption,
}
