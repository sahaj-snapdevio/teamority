import { cn } from "@/lib/utils";

const SIZES = {
  xs: { box: "size-4", dot: "size-2", emoji: "text-[13px]" },
  sm: { box: "size-5", dot: "size-2.5", emoji: "text-[15px]" },
  md: { box: "size-6", dot: "size-3", emoji: "text-lg" },
} as const;

interface SpaceIconProps {
  className?: string;
  /** Fallback dot color when no emoji is set. */
  color?: string | null;
  /** Extra classes applied only to the fallback dot (e.g. opacity for archived). */
  dotClassName?: string;
  /** The project's chosen emoji, or null/undefined to fall back to the color dot. */
  emoji?: string | null;
  size?: keyof typeof SIZES;
}

/**
 * The visual marker for a Project (space): its emoji icon when one is set,
 * otherwise the legacy colored dot. Centralizes the emoji-or-dot fallback so
 * every render site (sidebar, breadcrumbs, switcher, search, menus, …) stays
 * consistent. See docs decision: emoji is optional and non-breaking.
 */
export function SpaceIcon({
  emoji,
  color,
  size = "xs",
  className,
  dotClassName,
}: SpaceIconProps) {
  const s = SIZES[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center leading-none",
        s.box,
        className
      )}
    >
      {emoji ? (
        <span className={cn("leading-none", s.emoji)}>{emoji}</span>
      ) : (
        <span
          className={cn("rounded-full", s.dot, dotClassName)}
          style={{ backgroundColor: color ?? "#9CA3AF" }}
        />
      )}
    </span>
  );
}
