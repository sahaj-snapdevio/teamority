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
  "not-configured": "bg-base-content/60",
  "restart-required": "bg-warning",
  failed: "bg-error",
};

const STATUS_BADGE_CLASS: Record<IntegrationStatus, string> = {
  configured: "border-success/30 bg-success-subtle text-success-strong",
  "not-configured": "border-base-300 bg-base-content/10 text-base-content/70",
  "restart-required": "border-warning/30 bg-warning/10 text-warning",
  failed: "border-error/30 bg-error/10 text-error",
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

/** Shown inside a card's expanded content when it's live via .env — explains
 * why the fields below are blank and what happens if the admin saves anyway. */
export const ENV_OVERRIDE_NOTE =
  "This provider is currently working using values from .env — the database has nothing saved for it, so the fields below are blank. Saving a configuration here will create a database entry that takes over from .env for this provider.";

/** Small provenance tag shown next to the status badge when a section is
 * live only because .env supplies what the database doesn't — see
 * IntegrationCard's `usingEnv` prop. */
export function UsingEnvBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-2xs font-medium text-info",
        className
      )}
    >
      Using .env
    </span>
  );
}
