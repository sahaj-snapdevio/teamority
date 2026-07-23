/**
 * Human-readable file size. Shared by attachment chips, the preview modal, and
 * the activity feed so byte formatting stays consistent (was duplicated inline).
 *   900   → "900 B"
 *   2048  → "2 KB"
 *   5.2e6 → "5.0 MB"
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.round(kb)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}
