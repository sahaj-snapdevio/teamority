"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type IntegrationStatus,
  IntegrationStatusBadge,
} from "./integration-status-badge";

export type { IntegrationStatus };

interface Props {
  /** The full settings form (e.g. <SmtpSettingsForm />) — rendered inside the
   * dialog on demand so it isn't mounted (and doesn't fetch/hold state) until
   * the user opens it. */
  children: ReactNode;
  description: string;
  icon: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  status: IntegrationStatus;
  title: string;
}

/** Compact summary card for a service integration, with a dialog that lazily
 * mounts the same full settings form used on /orbit/integrations — no
 * duplicate configuration UI. Used by the setup wizard's Configure Services
 * step, which needs a quick glanceable list rather than long inline forms. */
export function IntegrationConfigCard({
  icon,
  title,
  description,
  status,
  open,
  onOpenChange,
  children,
}: Props) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
            <IntegrationStatusBadge status={status} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {description}
          </p>
        </div>
        <button
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          onClick={() => onOpenChange(true)}
          type="button"
        >
          {status === "not-configured" ? "Configure" : "Edit"}
          <ArrowRightIcon className="size-3.5" />
        </button>
      </div>

      <DialogContent className="max-h-[85vh] w-full max-w-xl overflow-y-auto border-0 bg-transparent p-0 shadow-none ring-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {open && children}
      </DialogContent>
    </Dialog>
  );
}
