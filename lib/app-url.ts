/**
 * Client-safe base URL for building shareable links. Prefers the configured
 * canonical app URL (NEXT_PUBLIC_APP_URL, inlined at build time) so links copied
 * from a production deployment point at the real host; falls back to the current
 * origin (correct for localhost and single-host deployments).
 */
export function appBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

/** Canonical URL for a task's detail page. */
export function taskUrl(workspaceId: string, taskId: string): string {
  return `${appBaseUrl()}/${workspaceId}/task/${taskId}`;
}
