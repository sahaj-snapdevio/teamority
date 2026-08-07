"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Single source of truth for the list-view shortcuts so the panel can't drift
// from what's actually wired up in list-view.tsx / the workspace shell.
const SHORTCUT_GROUPS: {
  title: string;
  items: { keys: string[]; label: string }[];
}[] = [
  {
    title: "Navigate",
    items: [
      { keys: ["↑", "↓"], label: "Move between tasks" },
      { keys: ["J", "K"], label: "Move between tasks" },
      { keys: ["Enter"], label: "Open the focused task" },
      {
        keys: ["Alt", "←/→"],
        label: "Previous / next task (inside Task Detail)",
      },
    ],
  },
  {
    title: "Actions",
    items: [
      { keys: ["C"], label: "Create a task" },
      { keys: ["X"], label: "Select / deselect the focused row" },
      { keys: ["Esc"], label: "Clear selection" },
    ],
  },
  {
    title: "Search & global",
    items: [
      { keys: ["/"], label: "Focus the search box" },
      { keys: ["Ctrl/⌘", "K"], label: "Command palette" },
      { keys: ["?"], label: "Show this panel" },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded-md border bg-base-200 px-1.5 py-0.5 font-mono text-xs font-medium text-base-content/60 shadow-sm">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Speed through the task list without the mouse.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-base-content/60">
                {group.title}
              </p>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li
                    className="flex items-center justify-between gap-4"
                    key={item.label + item.keys.join("")}
                  >
                    <span className="text-sm text-base-content">
                      {item.label}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
