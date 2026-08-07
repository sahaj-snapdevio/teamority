"use client";

import * as React from "react";
import { XIcon } from "@phosphor-icons/react";
import { FocusTrap, FocusTrapFeatures } from "@headlessui/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogDescription,
  useDialogContext,
} from "@/components/ui/dialog";
import { usePresence, useDismiss } from "@/components/ui/floating";
import { useRestorePreviousFocus, useScrollLock } from "@/components/ui/overlay";

// Sheet is a slide-in variant of Dialog and reuses its context, trigger,
// portal, close, focus-trap and scroll-lock wholesale — only Overlay/Content/
// Title differ (side-anchored positioning + slide animation instead of
// centered, and a distinct uppercase title style).
const Sheet = Dialog;
const SheetTrigger = DialogTrigger;
const SheetClose = DialogClose;
const SheetPortal = DialogPortal;
const SheetDescription = DialogDescription;

function SheetTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const { titleId } = useDialogContext("SheetTitle");
  return (
    <h2
      id={titleId}
      data-slot="sheet-title"
      className={cn(
        "font-heading text-lg font-semibold tracking-wider text-base-content uppercase",
        className,
      )}
      {...props}
    />
  );
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { open } = useDialogContext("SheetOverlay");
  return (
    <div
      data-slot="sheet-overlay"
      data-state={open ? "open" : "closed"}
      className={cn(
        "fixed inset-0 z-50 bg-black/20 duration-100 fill-mode-forwards supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  const { open, setOpen, contentRef, titleId, descriptionId } =
    useDialogContext("SheetContent");
  const mounted = usePresence(open, 200);

  useScrollLock(open);
  useRestorePreviousFocus(open);
  useDismiss({
    open,
    onOpenChange: setOpen,
    containerRefs: [contentRef],
    closeOnOutsidePointerDown: false,
  });

  if (!mounted) return null;

  return (
    <SheetPortal>
      <SheetOverlay onClick={() => setOpen(false)} />
      <FocusTrap
        ref={contentRef as React.Ref<HTMLDivElement>}
        features={
          open
            ? FocusTrapFeatures.InitialFocus | FocusTrapFeatures.TabLock
            : FocusTrapFeatures.None
        }
        data-slot="sheet-content"
        data-side={side}
        data-state={open ? "open" : "closed"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={cn(
          "fixed z-50 flex flex-col bg-elevated bg-clip-padding text-sm text-base-content shadow-md transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right-10 data-[side=top]:data-closed:slide-out-to-top-10",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetClose data-slot="sheet-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-4 right-4 bg-secondary"
              size="icon"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </SheetClose>
        )}
      </FocusTrap>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-8", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-8", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
