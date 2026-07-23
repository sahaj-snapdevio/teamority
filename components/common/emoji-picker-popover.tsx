"use client";

import dynamic from "next/dynamic";
import { XIcon } from "@phosphor-icons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SpaceIcon } from "@/components/common/space-icon";

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
          <div key={i} className="size-7 rounded bg-muted animate-pulse" />
        ))}
      </div>
      <div className="h-3 w-20 rounded bg-muted animate-pulse" />
      <div className="grid grid-cols-8 gap-1">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="size-8 rounded bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  ),
});

interface EmojiPickerPopoverProps {
  /** Currently-selected emoji, or null when none is chosen. */
  value: string | null;
  onChange: (emoji: string | null) => void;
  /** Fallback dot color shown in the trigger when no emoji is set. */
  color?: string | null;
  className?: string;
}

/**
 * A shadcn Popover wrapping the shared emoji-mart picker, for choosing a single
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
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Choose icon"
          className={cn(
            "flex size-10 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-accent",
            className
          )}
        >
          <SpaceIcon emoji={value} color={color} size="md" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-0 shadow-lg" align="start">
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex w-full items-center gap-1.5 border-b border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <XIcon className="size-3.5 shrink-0" />
            Remove icon
          </button>
        )}
        <EmojiPicker
          data={loadEmojiData}
          onEmojiSelect={(e: { native: string }) => onChange(e.native)}
          theme={
            typeof document !== "undefined" &&
            document.documentElement.classList.contains("dark")
              ? "dark"
              : "light"
          }
          previewPosition="none"
          skinTonePosition="none"
          maxFrequentRows={2}
          perLine={8}
        />
      </PopoverContent>
    </Popover>
  );
}
