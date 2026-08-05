"use client"

import * as React from "react"
import { FocusTrap, FocusTrapFeatures } from "@headlessui/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogTitle,
  DialogDescription,
  useDialogContext,
} from "@/components/ui/dialog"
import { usePresence, useDismiss } from "@/components/ui/floating"
import { useRestorePreviousFocus, useScrollLock } from "@/components/ui/overlay"

// AlertDialog reuses Dialog's context, focus-trap, scroll-lock and portal
// wholesale — the only real difference from a plain Dialog is that it must
// not be dismissible by clicking the overlay (it requires an explicit
// Action/Cancel choice), so only Overlay/Content are reimplemented.
const AlertDialog = Dialog
const AlertDialogTrigger = DialogTrigger
const AlertDialogPortal = DialogPortal
const AlertDialogTitle = DialogTitle
const AlertDialogDescription = DialogDescription

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { open } = useDialogContext("AlertDialogOverlay")
  return (
    <div
      data-slot="alert-dialog-overlay"
      data-state={open ? "open" : "closed"}
      className={cn(
        "fixed inset-0 z-50 bg-black/20 duration-100 fill-mode-forwards data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
}) {
  const { open, setOpen, contentRef, titleId, descriptionId } =
    useDialogContext("AlertDialogContent")
  const mounted = usePresence(open, 150)

  useScrollLock(open)
  useRestorePreviousFocus(open)
  useDismiss({
    open,
    onOpenChange: setOpen,
    containerRefs: [contentRef],
    // AlertDialog requires an explicit Action/Cancel choice — no
    // click-outside dismissal, matching radix-ui's AlertDialog semantics.
    closeOnOutsidePointerDown: false,
  })

  if (!mounted) return null

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <FocusTrap
        ref={contentRef as React.Ref<HTMLDivElement>}
        features={
          open
            ? FocusTrapFeatures.InitialFocus | FocusTrapFeatures.TabLock
            : FocusTrapFeatures.None
        }
        data-slot="alert-dialog-content"
        data-size={size}
        data-state={open ? "open" : "closed"}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={cn(
          "group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-6 rounded-xl bg-popover p-6 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 fill-mode-forwards outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-2 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-16 items-center justify-center rounded-xl bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-8",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"button"> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button variant={variant} size={size} asChild>
      <DialogClose data-slot="alert-dialog-action" className={cn(className)} {...props} />
    </Button>
  )
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: React.ComponentProps<"button"> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button variant={variant} size={size} asChild>
      <DialogClose data-slot="alert-dialog-cancel" className={cn(className)} {...props} />
    </Button>
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
