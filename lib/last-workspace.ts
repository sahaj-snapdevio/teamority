/**
 * Remembers the workspace the user was last looking at, so returning to the app
 * — e.g. via "Back to app" from the admin console, or a fresh sign-in — lands
 * them where they left off instead of always the first workspace they created.
 *
 * A plain (non-httpOnly) cookie: it's only a navigation hint, written client-
 * side by the workspace shell and read + validated server-side in /post-auth.
 */
export const LAST_WORKSPACE_COOKIE = "last_workspace_id";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

/** Client-side: record the workspace currently being viewed. */
export function rememberWorkspace(workspaceId: string): void {
  // biome-ignore lint/suspicious/noDocumentCookie: legitimate client-side cookie write (non-httpOnly navigation hint); consistent with app/setup/setup-wizard.tsx's applyTheme
  document.cookie = `${LAST_WORKSPACE_COOKIE}=${workspaceId}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}
