"use client";

import { BellIcon, XIcon } from "@phosphor-icons/react";
import * as React from "react";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "push_banner_dismissed";

export function PushNotificationBanner({
  workspaceId: _workspaceId,
}: {
  workspaceId: string;
}) {
  const { supported, permission, subscribed, enable } = usePushSubscription();
  const [dismissed, setDismissed] = React.useState(true); // start hidden to avoid flash
  const [enabling, setEnabling] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const alreadyDismissed = localStorage.getItem(STORAGE_KEY) === "1";
    setDismissed(alreadyDismissed);
  }, []);

  React.useEffect(() => {
    // Show banner only if: supported, permission not decided yet, not dismissed, not subscribed
    if (supported && permission === "default" && !dismissed && !subscribed) {
      // Small delay so it doesn't flash immediately on mount
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [supported, permission, dismissed, subscribed]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
    setVisible(false);
  }

  async function handleEnable() {
    setEnabling(true);
    const ok = await enable();
    setEnabling(false);
    if (ok) {
      dismiss();
    }
  }

  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b bg-primary/5 px-4 py-2.5 text-sm transition-all sm:flex-row sm:items-center sm:gap-3"
      )}
    >
      <div className="flex items-start gap-3 sm:flex-1 sm:items-center">
        <BellIcon className="size-4 shrink-0 text-primary" weight="fill" />
        <p className="min-w-0 flex-1 text-base-content">
          Stay updated in real time —{" "}
          <span className="text-base-content/60">
            enable browser notifications to get alerts even when the app is in
            the background.
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 pl-7 sm:pl-0">
        <button
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-content hover:bg-primary/90 transition-colors disabled:opacity-60"
          disabled={enabling}
          onClick={handleEnable}
          type="button"
        >
          {enabling ? "Enabling…" : "Enable"}
        </button>
        <button
          className="text-xs text-base-content/60 hover:text-base-content transition-colors"
          onClick={dismiss}
          type="button"
        >
          Not now
        </button>
        <button
          aria-label="Dismiss"
          className="ml-1 flex size-6 items-center justify-center rounded-md hover:bg-base-200 transition-colors text-base-content/60 hover:text-base-content"
          onClick={dismiss}
          type="button"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
