"use client";

import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  type IntegrationStatus,
  IntegrationStatusBadge,
  UsingEnvBadge,
} from "./integration-status-badge";

export type { IntegrationStatus };

interface Props {
  children: ReactNode;
  description: string;
  icon: ReactNode;
  note?: ReactNode;
  /** Controlled open state — omit for a standalone card that manages its own
   * (always-open) state, e.g. inside the setup wizard's dialog. Pass both (or
   * neither) of `open`/`onOpenChange`; on /orbit/integrations these are lifted
   * so only one provider card is expanded at a time. */
  onOpenChange?: (open: boolean) => void;
  /** Omit for sections with no "unconfigured" state to return to (e.g. storage,
   * whose default is the equally-valid "local" driver, not "unset"). */
  onRemove?: () => void;
  onSave: () => void;
  /** Omit where a live connection check isn't supported (Google OAuth, Web Push). */
  onTest?: () => void;
  open?: boolean;
  removing?: boolean;
  saving: boolean;
  status: IntegrationStatus;
  testing?: boolean;
  title: string;
  /** True when this section has nothing saved in the database but is live
   * because .env supplies a usable config — shows a small "Using .env" tag
   * next to the status badge and hides Remove (there's nothing in the DB to
   * remove). */
  usingEnv?: boolean;
  /** Accordion item id — must be unique among sibling cards sharing the same
   * `open`/`onOpenChange` state. */
  value: string;
}

/** Collapsible provider card for /orbit/integrations and the setup wizard's
 * Configure Services step. Wraps its own single-item <Accordion> (rather than
 * relying on a shared ancestor) so it works both standalone inside a dialog
 * and lifted/controlled from a page that wants only one card open at a time.
 * Rounded-xl card per CLAUDE.md. */
export function IntegrationCard({
  value,
  title,
  description,
  icon,
  status,
  note,
  saving,
  removing,
  testing,
  usingEnv,
  open,
  onOpenChange,
  onSave,
  onRemove,
  onTest,
  children,
}: Props) {
  const controlled = open !== undefined;

  return (
    <Accordion
      collapsible
      onValueChange={onOpenChange && ((next) => onOpenChange(next === value))}
      type="single"
      {...(controlled
        ? { value: open ? value : undefined }
        : { defaultValue: value })}
    >
      <AccordionItem
        className="overflow-hidden rounded-xl border border-border bg-card"
        value={value}
      >
        <AccordionTrigger className="items-center px-5 py-4 hover:no-underline sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {title}
                </h3>
                <IntegrationStatusBadge status={status} />
                {usingEnv && <UsingEnvBadge />}
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs font-normal text-muted-foreground">
                {description}
              </p>
            </div>
            <span className="hidden shrink-0 text-xs font-medium text-primary sm:inline">
              {status === "not-configured" ? "Configure" : "Edit"}
            </span>
          </div>
        </AccordionTrigger>

        <AccordionContent className="border-t border-border px-5 pt-5 sm:px-6">
          <div className="space-y-5">
            <div className="space-y-4">{children}</div>

            {note && (
              <p className="rounded-md bg-accent/40 px-3 py-2 text-xs text-muted-foreground">
                {note}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              {(status === "configured" || status === "restart-required") &&
              !usingEnv &&
              onRemove ? (
                <Button
                  className="text-destructive hover:text-destructive"
                  disabled={saving || removing || testing}
                  onClick={onRemove}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {removing ? "Removing…" : "Remove"}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                {onTest && (
                  <Button
                    disabled={saving || removing || testing}
                    onClick={onTest}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {testing ? "Testing…" : "Test Connection"}
                  </Button>
                )}
                <Button
                  disabled={saving || removing || testing}
                  onClick={onSave}
                  size="sm"
                  type="button"
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
