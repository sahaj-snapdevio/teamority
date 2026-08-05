"use client";

import { XIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import * as React from "react";
import { SpaceIcon } from "@/components/common/space-icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Stable reference — emoji-mart's Picker re-indexes the entire emoji dataset
// whenever its `data` prop identity changes, so this must stay a single shared
// function rather than an inline arrow recreated per render (which caused a
// visible lag on every popover open). Mirrors components/task/task-activity-feed.tsx.
const loadEmojiData = () =>
  import("@emoji-mart/data").then((mod) => mod.default);

const EmojiPicker = dynamic(() => import("@emoji-mart/react"), {
  ssr: false,
  loading: () => (
    <div className="w-88 p-3 space-y-2">
      <div className="h-8 rounded-md bg-muted animate-pulse" />
      <div className="flex gap-1 pb-1 border-b border-border">
        {Array.from({ length: 9 }).map((_, i) => (
          <div className="size-7 rounded bg-muted animate-pulse" key={i} />
        ))}
      </div>
      <div className="h-3 w-20 rounded bg-muted animate-pulse" />
      <div className="grid grid-cols-8 gap-1">
        {Array.from({ length: 40 }).map((_, i) => (
          <div className="size-8 rounded bg-muted animate-pulse" key={i} />
        ))}
      </div>
    </div>
  ),
});

interface EmojiPickerPopoverProps {
  className?: string;
  /** Fallback dot color shown in the trigger when no emoji is set. */
  color?: string | null;
  onChange: (emoji: string | null) => void;
  /** Currently-selected emoji, or null when none is chosen. */
  value: string | null;
}

/**
 * A Popover wrapping the shared emoji-mart picker, for choosing a single
 * emoji icon (used by Projects/spaces). Reuses the established emoji-mart
 * pattern — do not add a second emoji library (see CLAUDE.md). The trigger shows
 * the current emoji or the fallback color dot; the menu offers a "Remove" action.
 */
export function EmojiPickerPopover({
  value,
  onChange,
  color,
  className,
}: EmojiPickerPopoverProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label="Choose icon"
          className={cn(
            "flex size-10 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-accent",
            className
          )}
          type="button"
        >
          <SpaceIcon color={color} emoji={value} size="md" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0 border-0 shadow-lg">
        {value && (
          <button
            className="flex w-full items-center gap-1.5 border-b border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            type="button"
          >
            <XIcon className="size-3.5 shrink-0" />
            Remove icon
          </button>
        )}
        <EmojiPicker
          data={loadEmojiData}
          maxFrequentRows={2}
          onEmojiSelect={(e: { native: string }) => {
            onChange(e.native);
            setOpen(false);
          }}
          perLine={8}
          previewPosition="none"
          skinTonePosition="none"
          theme={
            typeof document !== "undefined" &&
            document.documentElement.classList.contains("dark")
              ? "dark"
              : "light"
          }
        />
      </PopoverContent>
    </Popover>
  );
}
