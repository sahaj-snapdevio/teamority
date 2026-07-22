import { PlusCircleIcon, TableIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// Phosphor has no single "add field/table" glyph, so this composites its
// Table icon with a PlusCircle badge overlapping the bottom-right corner —
// the PlusCircle's "fill" weight punches its cross out as negative space
// (a single currentColor path, not a layered white knockout), so it reads
// correctly against any button background. Used by the "Manage Custom
// Fields" toolbar shortcut in list-view.tsx and board-view.tsx.
export function ManageFieldsIcon({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <TableIcon className="size-full" weight="bold" />
      <PlusCircleIcon
        className="absolute -bottom-0.5 -right-0.5 size-[60%]"
        weight="fill"
      />
    </span>
  );
}
