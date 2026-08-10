"use client";

import * as React from "react";

// Browser permission is NOT the same as intent: a user can leave permission
// "granted" but still want push off. Without this, `workspace-shell` (which
// calls this hook on every page just to auto-subscribe) would silently
// re-subscribe on the next mount and undo the Disable button.
const OPT_OUT_KEY = "push_opt_out";

// Several components use this hook independently (settings page, banner,
// workspace shell). They don't share React state, so a change in one is
// broadcast to the others.
const CHANGE_EVENT = "kanbanica:push-subscription-change";

function isOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

function setOptedOut(value: boolean) {
  try {
    if (value) {
      localStorage.setItem(OPT_OUT_KEY, "1");
    } else {
      localStorage.removeItem(OPT_OUT_KEY);
    }
  } catch {
    // storage unavailable (private mode) — in-memory state still applies
  }
}

function broadcastSubscribed(subscribed: boolean) {
  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT, { detail: { subscribed } })
  );
}

// The VAPID public key is resolved at RUNTIME from the server (works on every
// deployment without a build-time NEXT_PUBLIC_ var). Falls back to the
// build-time inlined value for backward compatibility with older setups.
async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/vapid-public-key");
    if (res.ok) {
      const data = (await res.json()) as { key?: string | null };
      if (data.key) {
        return data.key;
      }
    }
  } catch {
    // ignore — fall back below
  }
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/** Upsert a subscription on the server. The POST route is an upsert by endpoint. */
async function saveSubscription(sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON();
  if (!json.keys?.p256dh || !json.keys?.auth) {
    return false;
  }

  const res = await fetch("/api/me/push-subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      userAgent: navigator.userAgent,
    }),
  });
  return res.ok;
}

async function registerAndSubscribe(vapidKey: string): Promise<boolean> {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !vapidKey
  ) {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // Re-send an existing subscription rather than assuming the server still
    // knows about it — the row may have been deleted by a Disable elsewhere.
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      return await saveSubscription(existing);
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });

    return await saveSubscription(sub);
  } catch {
    return false;
  }
}

export function usePushSubscription() {
  const [permission, setPermission] =
    React.useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = React.useState(false);
  const [supported, setSupported] = React.useState(false);
  const vapidKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const browserOk =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    if (!browserOk) {
      return;
    }

    let active = true;
    void (async () => {
      const key = await fetchVapidPublicKey();
      if (!active) {
        return;
      }
      vapidKeyRef.current = key;
      // Supported only when the browser can do push AND a VAPID key is configured.
      setSupported(!!key);
      if (!key) {
        return;
      }

      setPermission(Notification.permission);

      // Granted permission alone must NOT re-subscribe: the user may have
      // turned push off explicitly. Only auto-heal the subscription when they
      // haven't opted out.
      if (Notification.permission !== "granted" || isOptedOut()) {
        if (active) {
          setSubscribed(false);
        }
        return;
      }

      const ok = await registerAndSubscribe(key);
      if (active) {
        setSubscribed(ok);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Keep the hook's other instances (settings page, banner, workspace shell)
  // in sync when one of them enables or disables push.
  React.useEffect(() => {
    const onChange = (e: Event) => {
      setSubscribed(
        (e as CustomEvent<{ subscribed: boolean }>).detail.subscribed
      );
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  async function enable(): Promise<boolean> {
    const key = vapidKeyRef.current;
    if (!supported || !key) {
      return false;
    }
    if (Notification.permission === "denied") {
      return false;
    }

    let perm: NotificationPermission = Notification.permission;
    if (perm !== "granted") {
      perm = await Notification.requestPermission();
      setPermission(perm);
    }

    if (perm !== "granted") {
      return false;
    }

    const ok = await registerAndSubscribe(key);
    if (ok) {
      setOptedOut(false);
    }
    setSubscribed(ok);
    broadcastSubscribed(ok);
    return ok;
  }

  async function disable(): Promise<void> {
    // Record intent first, so an error below can't leave us auto-resubscribing.
    setOptedOut(true);

    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch(
          `/api/me/push-subscriptions?endpoint=${encodeURIComponent(sub.endpoint)}`,
          {
            method: "DELETE",
          }
        );
        await sub.unsubscribe();
      }
    } catch {
      // Best effort: the local opt-out below still stops push being re-enabled.
    }

    // Always reflect the user's choice, even if there was no registration.
    setSubscribed(false);
    broadcastSubscribed(false);
  }

  return { supported, permission, subscribed, enable, disable };
}
