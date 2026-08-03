"use client";

import * as React from "react";
import type { Placement } from "@floating-ui/dom";

import { cn } from "@/lib/utils";
import { Slot } from "@/components/ui/slot";
import { Portal, useFloatingPosition, useDismiss, usePresence } from "@/components/ui/floating";
import { createPreventableEvent, useReturnFocusOnClose, type PreventableEvent } from "@/components/ui/overlay";

type Side = "top" | "right" | "bottom" | "left";
type Align = "start" | "center" | "end";

function toPlacement(side: Side, align: Align): Placement {
  return align === "center" ? side : (`${side}-${align}` as Placement);
}

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLElement | null>;
  anchorRef: React.RefObject<HTMLElement | null>;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopoverContext(component: string) {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error(`${component} must be used within <Popover>`);
  }
  return context;
}

function Popover({
  open: openProp,
  defaultOpen,
  onOpenChange,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const open = openProp ?? internalOpen;
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLElement | null>(null);
  const anchorRef = React.useRef<HTMLElement | null>(null);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange]
  );

  useReturnFocusOnClose(triggerRef, open);

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef, contentRef, anchorRef }}>
      {children}
    </PopoverContext.Provider>
  );
}

function PopoverTrigger({
  asChild,
  onClick,
  children,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { open, setOpen, triggerRef } = usePopoverContext("PopoverTrigger");
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={triggerRef as React.Ref<HTMLButtonElement>}
      data-slot="popover-trigger"
      type={asChild ? undefined : "button"}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        setOpen(!open);
      }}
      {...props}
    >
      {children}
    </Comp>
  );
}

function PopoverAnchor({
  asChild,
  children,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const { anchorRef } = usePopoverContext("PopoverAnchor");
  const Comp = asChild ? Slot : "div";
  return (
    <Comp ref={anchorRef as React.Ref<HTMLDivElement>} {...props}>
      {children}
    </Comp>
  );
}

function PopoverContent({
  className,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  collisionPadding = 8,
  onWheel,
  onOpenAutoFocus,
  onEscapeKeyDown,
  onPointerDownOutside,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  side?: Side;
  align?: Align;
  sideOffset?: number;
  collisionPadding?: number;
  onOpenAutoFocus?: (event: PreventableEvent) => void;
  onEscapeKeyDown?: (event: PreventableEvent) => void;
  onPointerDownOutside?: (event: PreventableEvent) => void;
}) {
  const { open, setOpen, triggerRef, contentRef, anchorRef } = usePopoverContext(
    "PopoverContent"
  );
  const mounted = usePresence(open);
  const { referenceRef, floatingRef, styles, placement } = useFloatingPosition({
    open: mounted,
    placement: toPlacement(side, align),
    gap: sideOffset,
    boundaryPadding: collisionPadding,
  });
  referenceRef.current = anchorRef.current ?? triggerRef.current;

  useDismiss({
    open,
    onOpenChange: setOpen,
    containerRefs: [triggerRef, contentRef],
    onEscapeKeyDown,
    onPointerDownOutside,
  });

  React.useEffect(() => {
    if (!open) return
    const event = createPreventableEvent();
    onOpenAutoFocus?.(event);
    if (event.defaultPrevented) return;
    const container = contentRef.current as HTMLElement | null;
    const firstFocusable = container?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted) return null;

  const resolvedSide = placement.split("-")[0] as Side;

  return (
    <Portal>
      <div
        ref={(node) => {
          contentRef.current = node;
          floatingRef.current = node;
        }}
        data-slot="popover-content"
        data-state={open ? "open" : "closed"}
        data-side={resolvedSide}
        style={styles}
        onWheel={(event) => {
          event.stopPropagation();
          onWheel?.(event);
        }}
        className={cn(
          "z-50 w-72 overscroll-contain rounded-md bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      />
    </Portal>
  );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-1 text-sm", className)}
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <div
      data-slot="popover-title"
      className={cn("text-xs font-semibold uppercase", className)}
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="popover-description"
      className={cn(
        "mt-0.5 text-sm leading-relaxed text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
