"use client";

import * as React from "react";
import { XIcon } from "@phosphor-icons/react";
import { FocusTrap, FocusTrapFeatures } from "@headlessui/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slot } from "@/components/ui/slot";
import { Portal, useDismiss, usePresence } from "@/components/ui/floating";
import {
  useScrollLock,
  useRestorePreviousFocus,
  createPreventableEvent,
  type PreventableEvent,
} from "@/components/ui/overlay";

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLElement | null>;
  titleId: string;
  descriptionId: string;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext(component: string) {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error(`${component} must be used within <Dialog>`);
  }
  return context;
}

function Dialog({
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
  const reactId = React.useId();

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange]
  );

  return (
    <DialogContext.Provider
      value={{
        open,
        setOpen,
        triggerRef,
        contentRef,
        titleId: `${reactId}-title`,
        descriptionId: `${reactId}-description`,
      }}
    >
      {children}
    </DialogContext.Provider>
  );
}

function DialogTrigger({
  asChild,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { open, setOpen, triggerRef } = useDialogContext("DialogTrigger");
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={triggerRef as React.Ref<HTMLButtonElement>}
      data-slot="dialog-trigger"
      type={asChild ? undefined : "button"}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        setOpen(true);
      }}
      {...props}
    />
  );
}

function DialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function DialogClose({
  asChild,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { setOpen } = useDialogContext("DialogClose");
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="dialog-close"
      type={asChild ? undefined : "button"}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        setOpen(false);
      }}
      {...props}
    />
  );
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { open } = useDialogContext("DialogOverlay");
  return (
    <div
      data-slot="dialog-overlay"
      data-state={open ? "open" : "closed"}
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/40 duration-100 fill-mode-forwards data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onOpenAutoFocus,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
  onOpenAutoFocus?: (event: PreventableEvent) => void;
  onEscapeKeyDown?: (event: PreventableEvent) => void;
  onPointerDownOutside?: (event: PreventableEvent) => void;
  onInteractOutside?: (event: PreventableEvent) => void;
}) {
  const { open, setOpen, contentRef, titleId, descriptionId } =
    useDialogContext("DialogContent");
  const mounted = usePresence(open, 150);

  useScrollLock(open);
  useRestorePreviousFocus(open);
  useDismiss({
    open,
    onOpenChange: setOpen,
    containerRefs: [contentRef],
    closeOnOutsidePointerDown: false,
    onEscapeKeyDown,
    onPointerDownOutside: (event) => {
      onPointerDownOutside?.(event);
      if (event.defaultPrevented) return;
      onInteractOutside?.(event);
    },
  });

  React.useEffect(() => {
    if (!open) return;
    const event = createPreventableEvent();
    onOpenAutoFocus?.(event);
    // Default autofocus-first-element is handled by <FocusTrap>; when
    // prevented we still want the trap active (Tab cycling), just without
    // stealing focus on open, so nothing else to do here besides letting
    // callers observe/prevent the event for parity with radix-ui's API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted) return null;

  return (
    <DialogPortal>
      <DialogOverlay onClick={() => setOpen(false)} />
      <FocusTrap
        ref={contentRef as React.Ref<HTMLDivElement>}
        features={
          open
            ? FocusTrapFeatures.InitialFocus | FocusTrapFeatures.TabLock
            : FocusTrapFeatures.None
        }
        data-slot="dialog-content"
        data-state={open ? "open" : "closed"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 gap-6 overflow-y-auto rounded-xl bg-elevated p-6 text-base-content text-sm shadow-lg ring-1 ring-base-content/10 duration-100 fill-mode-forwards outline-none sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="absolute top-4 right-4 size-7">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        )}
      </FocusTrap>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />;
}

function DialogFooter({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const { titleId } = useDialogContext("DialogTitle");
  return (
    <h2
      id={titleId}
      data-slot="dialog-title"
      className={cn("font-semibold text-lg leading-none", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { descriptionId } = useDialogContext("DialogDescription");
  return (
    <p
      id={descriptionId}
      data-slot="dialog-description"
      className={cn("mt-0.5 text-base-content/60 text-sm leading-relaxed", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogContext,
  useDialogContext,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
