"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";
import { playNotificationSound } from "@/lib/notifications/sound";

const soundPrefFetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Realtime collaboration client.
 *
 * Opens a single SSE connection (the shared `/api/me/notifications/stream`) and,
 * when another member changes something in THIS workspace, re-pulls fresh data:
 *   - `router.refresh()` covers the server-rendered views (List, Board, sidebar);
 *   - subscribers (client-fetched views like Sprint) are notified to re-fetch.
 *
 * A refresh is auto-applied but DEFERRED while the user is busy (typing, an
 * overlay open, or mid-drag) or the tab is inactive, then flushed once idle.
 */

const DEBOUNCE_MS = 600;
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

/** Scope hint carried by a `data_changed` event (see lib/realtime/broadcast.ts). */
export interface RefetchMeta {
  /** Present when the change was task-scoped. Absent = "might affect anyone". */
  taskId?: string;
}

type RefetchHandler = (meta?: RefetchMeta) => void;

interface RealtimeContextValue {
  /** Pause auto-refresh (e.g. during a drag). Returns a `resume` fn. */
  pause: () => () => void;
  /** Subscribe a client-fetched view's re-fetch. Returns an unsubscribe fn. */
  subscribe: (handler: RefetchHandler) => () => void;
}

const RealtimeContext = React.createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  // Same SWR cache key the notification settings page uses — toggling the
  // "In-App Notification Sound" setting there calls `mutate()` on this exact
  // key, so this copy updates immediately with no extra plumbing.
  const { data: soundPrefData } = useSWR(
    "/api/me/email-preferences",
    soundPrefFetcher
  );
  const soundEnabledRef = React.useRef(true);
  soundEnabledRef.current = soundPrefData?.preference?.soundEnabled ?? true;

  const workspaceIdRef = React.useRef(workspaceId);
  workspaceIdRef.current = workspaceId;
  const routerRef = React.useRef(router);
  routerRef.current = router;

  const subscribersRef = React.useRef<Set<RefetchHandler>>(new Set());
  const interactionCountRef = React.useRef(0);

  // A single coalesced pending refresh: `pendingRef` is set on the first event
  // of a burst and stays set (ignoring further events) until it's flushed.
  const pendingRef = React.useRef(false);
  const pendingForRef = React.useRef<string | null>(null);
  // Scope hint of the coalesced burst. Cleared to `undefined` (= generic) as
  // soon as a burst mixes different tasks, so no subscriber wrongly skips.
  const pendingMetaRef = React.useRef<RefetchMeta | undefined>(undefined);
  const flushTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // True while a refresh must wait: inactive tab, active editing, an open
  // overlay we control, or an explicit drag pause.
  const shouldDefer = React.useCallback(() => {
    if (typeof document === "undefined") {
      return false;
    }
    if (document.hidden || !document.hasFocus()) {
      return true;
    }
    if (interactionCountRef.current > 0) {
      return true;
    }
    const el = document.activeElement as HTMLElement | null;
    if (
      el &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable)
    ) {
      return true;
    }
    // Specific shadcn/Radix overlays only (not a blanket [data-state="open"]):
    // Dialog, Dropdown Menu, Select/Command/slash menu, Popover/Date-picker.
    if (
      document.querySelector(
        '[role="dialog"],[role="menu"],[role="listbox"],[data-radix-popper-content-wrapper]'
      )
    ) {
      return true;
    }
    return false;
  }, []);

  const doRefresh = React.useCallback((meta?: RefetchMeta) => {
    routerRef.current.refresh();
    for (const handler of subscribersRef.current) {
      try {
        handler(meta);
      } catch {
        /* a bad subscriber must not break the others */
      }
    }
  }, []);

  const attemptFlush = React.useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (!pendingRef.current) {
      return;
    }
    if (shouldDefer()) {
      return; // stay pending; a clearing event will retry
    }
    if (pendingForRef.current !== workspaceIdRef.current) {
      // User navigated to a different workspace since the event — drop it.
      pendingRef.current = false;
      pendingForRef.current = null;
      pendingMetaRef.current = undefined;
      return;
    }
    const meta = pendingMetaRef.current;
    pendingRef.current = false;
    pendingForRef.current = null;
    pendingMetaRef.current = undefined;
    doRefresh(meta);
  }, [shouldDefer, doRefresh]);

  const requestRefresh = React.useCallback(
    (forWorkspace: string, meta?: RefetchMeta) => {
      if (pendingRef.current) {
        // Coalescing a burst: if this event names a different task than the
        // pending one (or either is generic), widen to a generic refetch so no
        // subscriber wrongly skips its update.
        if (pendingMetaRef.current?.taskId !== meta?.taskId) {
          pendingMetaRef.current = undefined;
        }
        return;
      }
      pendingRef.current = true;
      pendingForRef.current = forWorkspace;
      pendingMetaRef.current = meta;
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(attemptFlush, DEBOUNCE_MS);
      }
    },
    [attemptFlush]
  );

  // SSE connection with exponential-backoff reconnect (survives laptop sleep).
  React.useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let delay = RECONNECT_MIN_MS;
    let closed = false;

    const connect = () => {
      es = new EventSource("/api/me/notifications/stream");
      es.onopen = () => {
        delay = RECONNECT_MIN_MS;
      };
      es.onmessage = (event) => {
        let data: {
          type?: string;
          v?: number;
          workspaceId?: string;
          taskId?: string;
          triggerType?: string;
          soundEligible?: boolean;
          title?: string;
          body?: string | null;
          url?: string;
          workspaceName?: string | null;
          workspaceIcon?: string | null;
        };
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        // A new in-app notification arrived — revalidate every notification
        // query (sidebar unread badge + the Inbox list) immediately, so the
        // badge updates live instead of waiting for the next SWR poll.
        // Notifications are cross-workspace, so this is NOT gated on workspaceId.
        if (data.type === "new_notification") {
          void mutate(
            // `includes` (not `startsWith`) so the Inbox's useSWRInfinite key —
            // which SWR prefixes with `$inf$` — is matched alongside the plain
            // bell/sidebar keys, keeping the open Inbox live over SSE.
            (key) =>
              typeof key === "string" && key.includes("/api/me/notifications"),
            undefined,
            { revalidate: true }
          );
          // Show an in-app toast ONLY when this window is focused + visible.
          // When it isn't (hidden tab, minimized, unfocused, or app closed), the
          // service worker shows a browser/desktop notification instead — this
          // avoids a duplicate popup. Either way the badge/Inbox already updated
          // above and the notification is saved server-side.
          const appFocused =
            typeof document !== "undefined" &&
            document.visibilityState === "visible" &&
            document.hasFocus();
          if (data.title && appFocused) {
            const url = data.url;
            const workspaceName = data.workspaceName;
            const workspaceIcon = data.workspaceIcon;
            toast(
              workspaceName ? (
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1 text-2xs font-medium text-muted-foreground">
                    <span aria-hidden>{workspaceIcon ?? "📁"}</span>
                    {workspaceName}
                  </span>
                  <span>{data.title}</span>
                </span>
              ) : (
                data.title
              ),
              {
                description: data.body ?? undefined,
                action: url
                  ? {
                      label: "View",
                      onClick: () => routerRef.current.push(url),
                    }
                  : undefined,
              }
            );
          }
          // Sound is independent of the toast above and of tab focus/
          // visibility (Slack-style — plays even when this tab is
          // backgrounded or minimized), gated only by the user's global sound
          // toggle and by the server-computed per-event "Sound" eligibility
          // (userNotificationPreference.soundEnabled). With several Kanbanica
          // tabs open, every tab reaches this call, but only the single
          // elected leader tab actually plays — see lib/notifications/sound.ts.
          if (soundEnabledRef.current && data.soundEligible) {
            playNotificationSound();
          }
          return;
        }
        if (data.type !== "data_changed" || data.v !== 1) {
          return;
        }
        if (!data.workspaceId || data.workspaceId !== workspaceIdRef.current) {
          return;
        }
        // `taskId` is optional — when absent, subscribers do a generic refetch.
        requestRefresh(
          data.workspaceId,
          data.taskId ? { taskId: data.taskId } : undefined
        );
      };
      es.onerror = () => {
        es?.close();
        es = null;
        if (closed) {
          return;
        }
        reconnectTimer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, RECONNECT_MAX_MS);
      };
    };
    connect();

    return () => {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      es?.close();
    };
  }, [requestRefresh]);

  // Flush a deferred refresh once the user becomes idle again.
  React.useEffect(() => {
    const onMaybeIdle = () => attemptFlush();
    document.addEventListener("visibilitychange", onMaybeIdle);
    window.addEventListener("focus", onMaybeIdle);
    document.addEventListener("focusout", onMaybeIdle);
    return () => {
      document.removeEventListener("visibilitychange", onMaybeIdle);
      window.removeEventListener("focus", onMaybeIdle);
      document.removeEventListener("focusout", onMaybeIdle);
    };
  }, [attemptFlush]);

  const value = React.useMemo<RealtimeContextValue>(
    () => ({
      subscribe(handler) {
        subscribersRef.current.add(handler);
        return () => {
          subscribersRef.current.delete(handler);
        };
      },
      pause() {
        interactionCountRef.current += 1;
        let released = false;
        return () => {
          if (released) {
            return;
          }
          released = true;
          interactionCountRef.current = Math.max(
            0,
            interactionCountRef.current - 1
          );
          attemptFlush();
        };
      },
    }),
    [attemptFlush]
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

/**
 * Re-fetch a client-fetched view (e.g. Sprint, task detail) when a live change
 * arrives. `meta.taskId` is present only for task-scoped changes, so a view can
 * skip work: `if (meta?.taskId && meta.taskId !== myTaskId) return;`
 */
export function useRealtimeRefetch(handler: (meta?: RefetchMeta) => void) {
  const ctx = React.useContext(RealtimeContext);
  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;
  React.useEffect(() => {
    if (!ctx) {
      return;
    }
    return ctx.subscribe((meta) => handlerRef.current(meta));
  }, [ctx]);
}

/**
 * Returns a `pause()` to bracket a drag: call it on drag start, then call the
 * returned `resume()` on drag end/cancel so a queued refresh applies afterward.
 */
export function useRealtimePause(): () => () => void {
  const ctx = React.useContext(RealtimeContext);
  return React.useCallback(() => ctx?.pause() ?? (() => {}), [ctx]);
}
