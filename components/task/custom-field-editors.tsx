"use client";

import { PlusIcon, XIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import * as React from "react";
import type { CustomFieldRow } from "@/app/actions/custom-field";
import { UserAvatar } from "@/components/common/user-avatar";
import { FacetOptionList } from "@/components/filters/facet-filter";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface CustomFieldMember {
  email: string | null;
  image?: string | null;
  name: string | null;
  userId: string;
}

// Dispatches to the right control for field.type. Every editor is built from
// existing primitives (Popover, Calendar, Checkbox, Input, Badge,
// FacetOptionList, UserAvatar) — no new interactive components.
//
// `onChange(null)` means "clear" — the parent routes that to
// deleteCustomFieldValue (revert to default) rather than persisting an
// explicit null, so callers must not special-case null themselves.
export function CustomFieldEditor({
  field,
  value,
  onChange,
  disabled,
  members,
  emptyPlaceholder,
}: {
  disabled: boolean;
  /** Overrides every type's default empty-state text (e.g. "—" for a
   * compact table cell). Omit to keep each type's own descriptive default
   * ("Set value", "Pick a date", "Unassigned"...) — unset by every caller
   * except the List View, so Task Detail is unaffected. */
  emptyPlaceholder?: string;
  field: CustomFieldRow;
  members: CustomFieldMember[];
  onChange: (value: unknown) => Promise<void>;
  value: unknown;
}) {
  switch (field.type) {
    case "TEXT":
      return (
        <InlineValueEditor
          disabled={disabled}
          onChange={onChange}
          placeholder={emptyPlaceholder ?? (field.placeholder || "Set value")}
          type="text"
          value={value as string | null}
        />
      );
    case "NUMBER":
      return (
        <InlineValueEditor
          disabled={disabled}
          max={field.config.max}
          min={field.config.min}
          onChange={onChange}
          placeholder={emptyPlaceholder ?? (field.placeholder || "Set value")}
          type="number"
          value={value as number | null}
        />
      );
    case "CHECKBOX":
      return (
        <CheckboxEditor
          disabled={disabled}
          onChange={onChange}
          value={!!value}
        />
      );
    case "SINGLE_SELECT":
      return (
        <SingleSelectEditor
          disabled={disabled}
          emptyPlaceholder={emptyPlaceholder}
          field={field}
          onChange={onChange}
          value={value as string | null}
        />
      );
    case "MULTI_SELECT":
      return (
        <MultiSelectEditor
          disabled={disabled}
          emptyPlaceholder={emptyPlaceholder}
          field={field}
          onChange={onChange}
          value={(value as string[] | null) ?? []}
        />
      );
    case "DATE":
      return (
        <DateEditor
          disabled={disabled}
          emptyPlaceholder={emptyPlaceholder}
          onChange={onChange}
          value={value as string | null}
        />
      );
    case "PERSON":
      return (
        <PersonEditor
          disabled={disabled}
          emptyPlaceholder={emptyPlaceholder}
          members={members}
          onChange={onChange}
          value={value as string | null}
        />
      );
    default:
      return null;
  }
}

// ─── TEXT / NUMBER — click-to-edit inline, mirrors the task title pattern ───

function InlineValueEditor({
  value,
  onChange,
  disabled,
  placeholder,
  type,
  min,
  max,
}: {
  disabled: boolean;
  max?: number;
  min?: number;
  onChange: (value: unknown) => Promise<void>;
  placeholder: string;
  type: "number" | "text";
  value: number | string | null;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  function startEdit() {
    if (disabled) {
      return;
    }
    setDraft(value === null || value === undefined ? "" : String(value));
    setEditing(true);
  }

  async function save() {
    setEditing(false);
    const trimmed = draft.trim();
    const original = value === null || value === undefined ? "" : String(value);
    if (trimmed === original) {
      return;
    }
    if (trimmed === "") {
      await onChange(null);
      return;
    }
    await onChange(type === "number" ? Number(trimmed) : trimmed);
  }

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  if (editing) {
    return (
      <Input
        autoFocus
        className="h-7 text-xs"
        max={max}
        min={min}
        onBlur={save}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        ref={inputRef}
        type={type}
        value={draft}
      />
    );
  }

  return (
    <button
      className={cn(
        "-mx-1 block w-full min-w-0 rounded px-1 py-0.5 text-left text-xs",
        disabled ? "cursor-default" : "cursor-text hover:bg-base-200"
      )}
      disabled={disabled}
      onClick={startEdit}
      type="button"
    >
      {value === null || value === undefined || value === "" ? (
        <span className="text-base-content/60">{placeholder}</span>
      ) : (
        <span className="block truncate">{String(value)}</span>
      )}
    </button>
  );
}

// ─── CHECKBOX — mirrors checklist item toggles ──────────────────────────────

function CheckboxEditor({
  value,
  onChange,
  disabled,
}: {
  disabled: boolean;
  onChange: (value: unknown) => Promise<void>;
  value: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={value}
        disabled={disabled}
        onCheckedChange={(v) => onChange(!!v)}
      />
      <span className="text-xs text-base-content/60">
        {value ? "Yes" : "No"}
      </span>
    </div>
  );
}

// ─── SINGLE_SELECT — mirrors the Priority popover ───────────────────────────

function optionBadge(option: { color?: string; label: string }) {
  return (
    <Badge
      className="max-w-full text-xs"
      style={
        option.color
          ? { backgroundColor: `${option.color}20`, color: option.color }
          : undefined
      }
      variant="secondary"
    >
      <span className="truncate">{option.label}</span>
    </Badge>
  );
}

function SingleSelectEditor({
  field,
  value,
  onChange,
  disabled,
  emptyPlaceholder,
}: {
  disabled: boolean;
  emptyPlaceholder?: string;
  field: CustomFieldRow;
  onChange: (value: unknown) => Promise<void>;
  value: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const options = field.config.options ?? [];
  const selected = options.find((o) => o.id === value);

  if (disabled) {
    return selected ? (
      optionBadge(selected)
    ) : (
      <span className="text-xs text-base-content/60">
        {emptyPlaceholder ?? "Not set"}
      </span>
    );
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex min-w-0 max-w-full items-center rounded-md px-1 py-0.5 text-xs transition-colors hover:bg-base-200"
          type="button"
        >
          {selected ? (
            optionBadge(selected)
          ) : (
            <span className="text-base-content/60">
              {emptyPlaceholder ?? "Set value"}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-2">
        <FacetOptionList
          emptyText="No options configured"
          onAfterToggle={() => setOpen(false)}
          onChange={(next) => onChange(next[0] ?? null)}
          options={options.map((o) => ({
            value: o.id,
            label: o.label,
            color: o.color,
          }))}
          searchable={options.length > 6}
          selected={value ? [value] : []}
          single
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── MULTI_SELECT — mirrors the Tags chips + popover ────────────────────────

function MultiSelectEditor({
  field,
  value,
  onChange,
  disabled,
  emptyPlaceholder,
}: {
  disabled: boolean;
  emptyPlaceholder?: string;
  field: CustomFieldRow;
  onChange: (value: unknown) => Promise<void>;
  value: string[];
}) {
  const options = field.config.options ?? [];
  const selected = options.filter((o) => value.includes(o.id));

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {selected.map((o) => (
        <Badge
          className="max-w-full gap-1 pr-1 text-xs"
          key={o.id}
          style={
            o.color
              ? { backgroundColor: `${o.color}20`, color: o.color }
              : undefined
          }
          variant="secondary"
        >
          <span className="truncate">{o.label}</span>
          {!disabled && (
            <button
              className="shrink-0 hover:opacity-70"
              onClick={() => onChange(value.filter((id) => id !== o.id))}
              type="button"
            >
              <XIcon className="size-2.5" />
            </button>
          )}
        </Badge>
      ))}
      {selected.length === 0 && (
        <span className="text-xs text-base-content/60">
          {emptyPlaceholder ?? "None"}
        </span>
      )}
      {!disabled && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="flex size-5 items-center justify-center rounded-full border border-dashed border-base-300 text-base-content/60 transition-colors hover:border-primary hover:text-primary"
              type="button"
            >
              <PlusIcon className="size-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 p-2">
            <FacetOptionList
              emptyText="No options configured"
              onChange={(next) => onChange(next)}
              options={options.map((o) => ({
                value: o.id,
                label: o.label,
                color: o.color,
              }))}
              searchable={options.length > 6}
              selected={value}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ─── DATE — mirrors the Due Date popover + Calendar ─────────────────────────

function DateEditor({
  value,
  onChange,
  disabled,
  emptyPlaceholder,
}: {
  disabled: boolean;
  emptyPlaceholder?: string;
  onChange: (value: unknown) => Promise<void>;
  value: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const date = value ? new Date(value) : null;

  if (disabled) {
    return date ? (
      <span className="text-xs">{format(date, "MMM d, yyyy")}</span>
    ) : (
      <span className="text-xs text-base-content/60">
        {emptyPlaceholder ?? "Not set"}
      </span>
    );
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center rounded-md border bg-base-100 px-2 py-1 text-xs transition-colors hover:bg-base-200"
          type="button"
        >
          {date ? (
            format(date, "MMM d, yyyy")
          ) : (
            <span className="text-base-content/60">
              {emptyPlaceholder ?? "Pick a date"}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          onSelect={(d) => {
            onChange(d ? d.toISOString() : null);
            setOpen(false);
          }}
          selected={date ?? undefined}
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── PERSON — single-select variant of the Assignees popover ───────────────

function PersonEditor({
  value,
  onChange,
  members,
  disabled,
  emptyPlaceholder,
}: {
  disabled: boolean;
  emptyPlaceholder?: string;
  members: CustomFieldMember[];
  onChange: (value: unknown) => Promise<void>;
  value: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const person = members.find((m) => m.userId === value);

  const chip = person ? (
    <div className="flex min-w-0 items-center gap-1 rounded-full bg-base-200 px-2 py-0.5">
      <UserAvatar
        email={person.email}
        image={person.image}
        name={person.name}
        size="xs"
      />
      <span className="max-w-20 truncate text-xs">
        {person.name ?? person.email}
      </span>
      {!disabled && (
        <button
          className="shrink-0 text-base-content/60 hover:text-base-content"
          onClick={() => onChange(null)}
          type="button"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </div>
  ) : (
    <span className="text-xs text-base-content/60">
      {emptyPlaceholder ?? "Unassigned"}
    </span>
  );

  if (disabled) {
    return chip;
  }

  return (
    <div className="flex items-center gap-1.5">
      {chip}
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <button
            className="flex size-5 items-center justify-center rounded-full border border-dashed border-base-300 text-base-content/60 transition-colors hover:border-primary hover:text-primary"
            type="button"
          >
            <PlusIcon className="size-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-52 p-2">
          <FacetOptionList
            emptyText="No members"
            onAfterToggle={() => setOpen(false)}
            onChange={(next) => onChange(next[0] ?? null)}
            options={members.map((m) => ({
              value: m.userId,
              label: m.name || m.email || "Unknown",
              icon: (
                <UserAvatar
                  email={m.email}
                  image={m.image}
                  name={m.name}
                  size="xs"
                />
              ),
            }))}
            searchable={members.length > 6}
            selected={value ? [value] : []}
            single
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
