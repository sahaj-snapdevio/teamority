import * as React from "react";

import { isOverlayOpen } from "@/components/ui/overlay-stack";

/**
 * Global "C" keyboard shortcut → open the Create Task popup, so a task can be
 * created from any task view without reaching for the mouse. Mirrors the guard
 * logic in the list view's keyboard handler:
 *   - ignored while typing (input / textarea / select / contenteditable),
 *   - ignored for modifier combos (Ctrl/Cmd/Alt),
 *   - ignored while any overlay (dialog / popover / dropdown) owns the keyboard.
 *
 * `onTrigger` is read through a ref so the listener isn't re-subscribed on every
 * render and never fires a stale closure.
 */
export function useCreateTaskShortcut(onTrigger: () => void, enabled = true) {
  const handler = React.useRef(onTrigger);
  handler.current = onTrigger;

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "c" && e.key !== "C") {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.isContentEditable ||
          t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT");
      if (typing) {
        return;
      }
      // Let an open overlay keep the keyboard (e.g. the Create modal itself).
      if (isOverlayOpen()) {
        return;
      }
      e.preventDefault();
      handler.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
