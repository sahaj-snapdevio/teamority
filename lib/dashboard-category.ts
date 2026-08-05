// Single source of truth for the Workspace Overview analytics category —
// independent of `listStatus.type` (Board/List column grouping). Shared by
// every status-creation entry point (list settings, Board "Add Group", List
// "New Status") so they all offer the same options in the same order.
export type DashboardCategory = "OPEN" | "WORKING" | "REVIEW" | "COMPLETED";

export const DASHBOARD_CATEGORY_OPTIONS: {
  value: DashboardCategory;
  label: string;
}[] = [
  { value: "OPEN", label: "Todo" },
  { value: "WORKING", label: "Working" },
  { value: "REVIEW", label: "Review" },
  { value: "COMPLETED", label: "Completed" },
];
