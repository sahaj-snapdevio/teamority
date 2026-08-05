// Active-task-count thresholds for the Team Workload badge. Adjust these to
// retune what counts as Light/Medium/Heavy — nothing else needs to change.
export const WORKLOAD_THRESHOLDS = {
  light: 5, // 0–5 active tasks
  medium: 10, // 6–10 active tasks
  // 11+ active tasks is Heavy
} as const;

export type WorkloadLevel = "light" | "medium" | "heavy";

export const WORKLOAD_LEVEL_CONFIG: Record<
  WorkloadLevel,
  { label: string; emoji: string }
> = {
  light: { label: "Light", emoji: "🟢" },
  medium: { label: "Medium", emoji: "🟡" },
  heavy: { label: "Heavy", emoji: "🔴" },
};

export function getWorkloadLevel(activeCount: number): WorkloadLevel {
  if (activeCount <= WORKLOAD_THRESHOLDS.light) {
    return "light";
  }
  if (activeCount <= WORKLOAD_THRESHOLDS.medium) {
    return "medium";
  }
  return "heavy";
}
