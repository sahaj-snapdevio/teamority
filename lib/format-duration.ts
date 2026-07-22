// Time-tracking duration formatters, shared by the section, the card badge, and
// the activity feed.

// Compact human total: "3h 42m" | "45m" | "3h" | "45s". Durations under a
// minute show seconds instead of always rounding down to "0m" — otherwise a
// genuine 20-second entry is indistinguishable from no time logged at all.
export function formatDuration(seconds: number | null | undefined): string {
  const raw = Math.max(0, Math.floor(seconds ?? 0));
  if (raw < 60) {
    return `${raw}s`;
  }
  const total = Math.floor(raw / 60); // whole minutes
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) {
    return `${h}h ${m}m`;
  }
  if (h > 0) {
    return `${h}h`;
  }
  return `${m}m`;
}

// Running-clock display: "HH:MM:SS" (hours grow past 2 digits).
export function formatTimer(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
