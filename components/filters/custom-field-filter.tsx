"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import * as React from "react";
import type { CustomFieldRow } from "@/app/actions/custom-field";
import { UserAvatar } from "@/components/common/user-avatar";
import { FacetOptionList } from "@/components/filters/facet-filter";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CheckboxFilterOperator,
  CustomFieldFilterValue,
  DateFilterOperator,
  MultiSelectFilterOperator,
  NumberFilterOperator,
  PersonFilterOperator,
  SingleSelectFilterOperator,
  TextFilterOperator,
} from "@/lib/custom-fields/filters";

export interface CustomFieldFilterMember {
  email: string | null;
  image?: string | null;
  name: string | null;
  userId: string;
}

// Renders the operator + value editor for one field's filter condition,
// rendered inline inside a FilterBuilder row (components/filters/
// filter-builder.tsx) — not behind its own trigger button, so both appear the
// instant a field is added rather than requiring a second click to "open" the
// control. Mirrors the CustomFieldEditor dispatcher (custom-field-editors.tsx)
// but for filter conditions instead of task values: every value picker below
// reuses that same vocabulary of existing primitives (Select, Input, Calendar,
// FacetOptionList, UserAvatar) — no new pickers.
export function CustomFieldFilterControl({
  field,
  value,
  onChange,
  members,
}: {
  field: CustomFieldRow;
  value: CustomFieldFilterValue | undefined;
  onChange: (next: CustomFieldFilterValue) => void;
  members: CustomFieldFilterMember[];
}) {
  switch (field.type) {
    case "TEXT":
      return (
        <TextFieldFilter
          field={field}
          onChange={onChange}
          value={value?.type === "TEXT" ? value : undefined}
        />
      );
    case "NUMBER":
      return (
        <NumberFieldFilter
          onChange={onChange}
          value={value?.type === "NUMBER" ? value : undefined}
        />
      );
    case "DATE":
      return (
        <DateFieldFilter
          onChange={onChange}
          value={value?.type === "DATE" ? value : undefined}
        />
      );
    case "CHECKBOX":
      return (
        <CheckboxFieldFilter
          onChange={onChange}
          value={value?.type === "CHECKBOX" ? value : undefined}
        />
      );
    case "SINGLE_SELECT":
      return (
        <SingleSelectFieldFilter
          field={field}
          onChange={onChange}
          value={value?.type === "SINGLE_SELECT" ? value : undefined}
        />
      );
    case "MULTI_SELECT":
      return (
        <MultiSelectFieldFilter
          field={field}
          onChange={onChange}
          value={value?.type === "MULTI_SELECT" ? value : undefined}
        />
      );
    case "PERSON":
      return (
        <PersonFieldFilter
          members={members}
          onChange={onChange}
          value={value?.type === "PERSON" ? value : undefined}
        />
      );
    default:
      return null;
  }
}

// Compact "current value ▼" button shared by every Popover-backed value
// picker below (single-select, multi-select, person, date) — same trigger
// shape as an <Input>, so operator Select + value picker line up visually.
function ValuePickerTrigger({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="flex h-8 w-full items-center justify-between gap-1.5 rounded-md border border-input bg-background px-2 text-xs"
      type="button"
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left">
        {children}
      </span>
      <CaretDownIcon className="size-3 shrink-0 opacity-60" />
    </button>
  );
}

function optionChip(option: { color?: string; label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 truncate">
      {option.color && (
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: option.color }}
        />
      )}
      <span className="truncate">{option.label}</span>
    </span>
  );
}

// ─── TEXT ────────────────────────────────────────────────────────────────────

const TEXT_OPERATORS: { value: TextFilterOperator; label: string }[] = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

function TextFieldFilter({
  field,
  value,
  onChange,
}: {
  field: CustomFieldRow;
  value: Extract<CustomFieldFilterValue, { type: "TEXT" }> | undefined;
  onChange: (next: CustomFieldFilterValue) => void;
}) {
  const operator = value?.operator ?? "contains";
  const draft = value?.value ?? "";
  const needsValue = operator !== "is_empty" && operator !== "is_not_empty";

  return (
    <div className="space-y-1.5">
      <Select
        onValueChange={(v) =>
          onChange({
            type: "TEXT",
            operator: v as TextFilterOperator,
            value: draft,
          })
        }
        value={operator}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TEXT_OPERATORS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {needsValue && (
        <Input
          className="h-8 text-xs"
          onChange={(e) =>
            onChange({
              type: "TEXT",
              operator,
              value: e.target.value || undefined,
            })
          }
          placeholder={field.placeholder || `${field.name}…`}
          value={draft}
        />
      )}
    </div>
  );
}

// ─── NUMBER ──────────────────────────────────────────────────────────────────

const NUMBER_OPERATORS: { value: NumberFilterOperator; label: string }[] = [
  { value: "eq", label: "=" },
  { value: "ne", label: "≠" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "between", label: "Between" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

function NumberFieldFilter({
  value,
  onChange,
}: {
  value: Extract<CustomFieldFilterValue, { type: "NUMBER" }> | undefined;
  onChange: (next: CustomFieldFilterValue) => void;
}) {
  const operator = value?.operator ?? "eq";
  const draft = value?.value;
  const draftMax = value?.valueMax;
  const needsValue = operator !== "is_empty" && operator !== "is_not_empty";
  const needsRange = operator === "between";

  return (
    <div className="space-y-1.5">
      <Select
        onValueChange={(v) =>
          onChange({
            type: "NUMBER",
            operator: v as NumberFilterOperator,
            value: draft,
            valueMax: draftMax,
          })
        }
        value={operator}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {NUMBER_OPERATORS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {needsValue && (
        <div className="flex items-center gap-1.5">
          <Input
            className="h-8 text-xs"
            onChange={(e) =>
              onChange({
                type: "NUMBER",
                operator,
                value:
                  e.target.value === "" ? undefined : Number(e.target.value),
                valueMax: draftMax,
              })
            }
            placeholder={needsRange ? "From" : "Value"}
            type="number"
            value={draft ?? ""}
          />
          {needsRange && (
            <Input
              className="h-8 text-xs"
              onChange={(e) =>
                onChange({
                  type: "NUMBER",
                  operator,
                  value: draft,
                  valueMax:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder="To"
              type="number"
              value={draftMax ?? ""}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── DATE ────────────────────────────────────────────────────────────────────

const DATE_OPERATORS: { value: DateFilterOperator; label: string }[] = [
  { value: "on", label: "On" },
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
  { value: "between", label: "Between" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

// Shared by single-date and the two Between endpoints — a compact button that
// opens the existing Calendar in a Popover, same pattern as the DATE editor
// in custom-field-editors.tsx.
function DatePickerButton({
  date,
  onSelect,
  placeholder = "Pick a date",
}: {
  date: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          className="flex h-8 flex-1 items-center justify-between rounded-md border border-input bg-background px-2 text-xs"
          type="button"
        >
          {date ? (
            format(date, "MMM d, yyyy")
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          onSelect={(d) => {
            onSelect(d);
            setOpen(false);
          }}
          selected={date}
        />
      </PopoverContent>
    </Popover>
  );
}

function DateFieldFilter({
  value,
  onChange,
}: {
  value: Extract<CustomFieldFilterValue, { type: "DATE" }> | undefined;
  onChange: (next: CustomFieldFilterValue) => void;
}) {
  const operator = value?.operator ?? "on";
  const needsDate =
    operator === "on" || operator === "before" || operator === "after";
  const needsRange = operator === "between";
  const selectedDate = value?.value ? new Date(value.value) : undefined;
  const selectedMax = value?.valueMax ? new Date(value.valueMax) : undefined;

  return (
    <div className="space-y-1.5">
      <Select
        onValueChange={(v) =>
          onChange({
            type: "DATE",
            operator: v as DateFilterOperator,
            value: value?.value,
            valueMax: value?.valueMax,
          })
        }
        value={operator}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_OPERATORS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {needsDate && (
        <DatePickerButton
          date={selectedDate}
          onSelect={(d) =>
            onChange({ type: "DATE", operator, value: d?.toISOString() })
          }
        />
      )}
      {needsRange && (
        <div className="flex items-center gap-1.5">
          <DatePickerButton
            date={selectedDate}
            onSelect={(d) =>
              onChange({
                type: "DATE",
                operator,
                value: d?.toISOString(),
                valueMax: value?.valueMax,
              })
            }
            placeholder="From"
          />
          <DatePickerButton
            date={selectedMax}
            onSelect={(d) =>
              onChange({
                type: "DATE",
                operator,
                value: value?.value,
                valueMax: d?.toISOString(),
              })
            }
            placeholder="To"
          />
        </div>
      )}
    </div>
  );
}

// ─── CHECKBOX ────────────────────────────────────────────────────────────────

const CHECKBOX_OPERATORS: { value: CheckboxFilterOperator; label: string }[] = [
  { value: "checked", label: "Checked" },
  { value: "unchecked", label: "Unchecked" },
];

function CheckboxFieldFilter({
  value,
  onChange,
}: {
  value: Extract<CustomFieldFilterValue, { type: "CHECKBOX" }> | undefined;
  onChange: (next: CustomFieldFilterValue) => void;
}) {
  const operator = value?.operator ?? "checked";
  return (
    <Select
      onValueChange={(v) =>
        onChange({ type: "CHECKBOX", operator: v as CheckboxFilterOperator })
      }
      value={operator}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CHECKBOX_OPERATORS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── SINGLE_SELECT ───────────────────────────────────────────────────────────

const SINGLE_SELECT_OPERATORS: {
  value: SingleSelectFilterOperator;
  label: string;
}[] = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

function SingleSelectFieldFilter({
  field,
  value,
  onChange,
}: {
  field: CustomFieldRow;
  value: Extract<CustomFieldFilterValue, { type: "SINGLE_SELECT" }> | undefined;
  onChange: (next: CustomFieldFilterValue) => void;
}) {
  const operator = value?.operator ?? "equals";
  const needsValue = operator === "equals" || operator === "not_equals";
  const options = field.config.options ?? [];
  const selected = options.find((o) => o.id === value?.value);

  return (
    <div className="space-y-1.5">
      <Select
        onValueChange={(v) =>
          onChange({
            type: "SINGLE_SELECT",
            operator: v as SingleSelectFilterOperator,
            value: value?.value,
          })
        }
        value={operator}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SINGLE_SELECT_OPERATORS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {needsValue && (
        <Popover>
          <PopoverTrigger asChild>
            <ValuePickerTrigger>
              {selected ? (
                optionChip(selected)
              ) : (
                <span className="text-muted-foreground">Pick option…</span>
              )}
            </ValuePickerTrigger>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1.5">
            <FacetOptionList
              emptyText="No options configured"
              onChange={(next) =>
                onChange({ type: "SINGLE_SELECT", operator, value: next[0] })
              }
              options={options.map((o) => ({
                value: o.id,
                label: o.label,
                color: o.color,
              }))}
              searchable={options.length > 6}
              selected={value?.value ? [value.value] : []}
              single
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ─── MULTI_SELECT ────────────────────────────────────────────────────────────

const MULTI_SELECT_OPERATORS: {
  value: MultiSelectFilterOperator;
  label: string;
}[] = [
  { value: "contains_any", label: "Contains any" },
  { value: "contains_all", label: "Contains all" },
  { value: "not_contains", label: "Does not contain" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

function MultiSelectFieldFilter({
  field,
  value,
  onChange,
}: {
  field: CustomFieldRow;
  value: Extract<CustomFieldFilterValue, { type: "MULTI_SELECT" }> | undefined;
  onChange: (next: CustomFieldFilterValue) => void;
}) {
  const operator = value?.operator ?? "contains_any";
  const needsValue =
    operator === "contains_any" ||
    operator === "contains_all" ||
    operator === "not_contains";
  const options = field.config.options ?? [];
  const selectedIds = value?.value ?? [];
  const selected = options.filter((o) => selectedIds.includes(o.id));

  return (
    <div className="space-y-1.5">
      <Select
        onValueChange={(v) =>
          onChange({
            type: "MULTI_SELECT",
            operator: v as MultiSelectFilterOperator,
            value: selectedIds,
          })
        }
        value={operator}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MULTI_SELECT_OPERATORS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {needsValue && (
        <Popover>
          <PopoverTrigger asChild>
            <ValuePickerTrigger>
              {selected.length > 0 ? (
                <span className="truncate">
                  {selected.map((o) => o.label).join(", ")}
                </span>
              ) : (
                <span className="text-muted-foreground">Pick options…</span>
              )}
            </ValuePickerTrigger>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1.5">
            <FacetOptionList
              emptyText="No options configured"
              onChange={(next) =>
                onChange({ type: "MULTI_SELECT", operator, value: next })
              }
              options={options.map((o) => ({
                value: o.id,
                label: o.label,
                color: o.color,
              }))}
              searchable={options.length > 6}
              selected={selectedIds}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ─── PERSON ──────────────────────────────────────────────────────────────────

const PERSON_OPERATORS: { value: PersonFilterOperator; label: string }[] = [
  { value: "is", label: "Is" },
  { value: "is_not", label: "Is not" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

function PersonFieldFilter({
  value,
  onChange,
  members,
}: {
  value: Extract<CustomFieldFilterValue, { type: "PERSON" }> | undefined;
  onChange: (next: CustomFieldFilterValue) => void;
  members: CustomFieldFilterMember[];
}) {
  const operator = value?.operator ?? "is";
  const needsValue = operator === "is" || operator === "is_not";
  const person = members.find((m) => m.userId === value?.value);

  return (
    <div className="space-y-1.5">
      <Select
        onValueChange={(v) =>
          onChange({
            type: "PERSON",
            operator: v as PersonFilterOperator,
            value: value?.value,
          })
        }
        value={operator}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERSON_OPERATORS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {needsValue && (
        <Popover>
          <PopoverTrigger asChild>
            <ValuePickerTrigger>
              {person ? (
                <>
                  <UserAvatar
                    email={person.email}
                    image={person.image}
                    name={person.name}
                    size="xs"
                  />
                  <span className="truncate">
                    {person.name ?? person.email}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Pick person…</span>
              )}
            </ValuePickerTrigger>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1.5">
            <FacetOptionList
              emptyText="No members"
              onChange={(next) =>
                onChange({ type: "PERSON", operator, value: next[0] })
              }
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
              selected={value?.value ? [value.value] : []}
              single
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
