import * as React from "react";

import { isOverlayOpen } from "@/components/ui/overlay-stack";

/**
 * Alt+Left / Alt+Right → Previous/Next task in Task Detail. Mirrors the guard
 * logic in `use-create-task-shortcut.ts`:
 *   - ignored while typing (input / textarea / select / contenteditable),
 *   - ignored while any overlay (dialog / popover / dropdown) owns the keyboard.
 *
 * `onPrev`/`onNext` are read through refs so the listener isn't re-subscribed
 * on every render and never fires a stale closure. Callers are expected to
 * no-op when there's nothing to navigate to (same as the disabled buttons).
 */
export function useTaskNavShortcut(
  onPrev: () => void,
  onNext: () => void,
  enabled = true
) {
  const prevHandler = React.useRef(onPrev);
  prevHandler.current = onPrev;
  const nextHandler = React.useRef(onNext);
  nextHandler.current = onNext;

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) {
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") {
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
      if (isOverlayOpen()) {
        return;
      }
      e.preventDefault();
      if (e.key === "ArrowLeft") {
        prevHandler.current();
      } else {
        nextHandler.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
