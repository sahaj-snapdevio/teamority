import { cn } from "@/lib/utils";

export type IntegrationStatus =
  | "configured"
  | "not-configured"
  | "restart-required"
  | "failed";

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  configured: "Connected",
  "not-configured": "Not configured",
  "restart-required": "Restart required",
  failed: "Failed",
};

const STATUS_DOT_CLASS: Record<IntegrationStatus, string> = {
  configured: "bg-success",
  "not-configured": "bg-muted-foreground",
  "restart-required": "bg-warning",
  failed: "bg-destructive",
};

const STATUS_BADGE_CLASS: Record<IntegrationStatus, string> = {
  configured: "border-success/30 bg-success-subtle text-success-foreground",
  "not-configured": "border-border bg-muted-foreground/10 text-foreground/70",
  "restart-required": "border-warning/30 bg-warning/10 text-warning",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
};

/** Shared status badge for provider cards on /orbit/integrations and the
 * setup wizard's Configure Services step — colored dot + label so status is
 * scannable at a glance instead of buried in a paragraph. */
export function IntegrationStatusBadge({
  status,
  className,
}: {
  status: IntegrationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium",
        STATUS_BADGE_CLASS[status],
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_DOT_CLASS[status])} />
      {STATUS_LABEL[status]}
    </span>
  );
}
