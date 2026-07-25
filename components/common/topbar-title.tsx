"use client";

import { useSetTopbar } from "@/lib/topbar-context";

/**
 * Renders a page's title/breadcrumb into the app topbar instead of duplicating
 * it in the content body.
 *
 * The topbar already has a title slot (`TopbarProvider` in the workspace shell,
 * read by `TopbarRightColumn`), but `useSetTopbar` is a hook — server-rendered
 * layouts like the settings ones can't call it. This is the client shim that
 * lets them: mount it with plain serializable props, render nothing.
 */
export function TopbarTitle({
  breadcrumbs = [],
  title,
}: {
  breadcrumbs?: Array<{
    color?: string | null;
    emoji?: string | null;
    href?: string;
    label: string;
  }>;
  title: string;
}) {
  useSetTopbar({ breadcrumbs, title });
  return null;
}
