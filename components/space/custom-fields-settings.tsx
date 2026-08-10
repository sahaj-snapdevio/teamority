"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToVerticalAxis,
  restrictToWindowEdges,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  CalendarBlankIcon,
  CheckSquareIcon,
  DatabaseIcon,
  DotsSixVerticalIcon,
  DotsThreeIcon,
  HashIcon,
  ListChecksIcon,
  PencilSimpleIcon,
  RadioButtonIcon,
  TextAaIcon,
  TrashIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { format } from "date-fns";
import * as React from "react";
import { toast } from "sonner";
import {
  archiveCustomFieldDefinition,
  type CustomFieldType,
  createCustomFieldDefinition,
  deleteCustomFieldDefinition,
  getCustomFieldDefinitions,
  getCustomFieldValueCount,
  reorderCustomFieldDefinitions,
  unarchiveCustomFieldDefinition,
  updateCustomFieldDefinition,
} from "@/app/actions/custom-field";
import { FacetOptionList } from "@/components/filters/facet-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SearchInput } from "@/components/ui/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const FIELD_TYPE_META: Record<
  CustomFieldType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  TEXT: { label: "Text", icon: TextAaIcon },
  NUMBER: { label: "Number", icon: HashIcon },
  CHECKBOX: { label: "Checkbox", icon: CheckSquareIcon },
  SINGLE_SELECT: { label: "Single Select", icon: RadioButtonIcon },
  MULTI_SELECT: { label: "Multi Select", icon: ListChecksIcon },
  DATE: { label: "Date", icon: CalendarBlankIcon },
  PERSON: { label: "Person", icon: UserIcon },
};

const FIELD_TYPES: { label: string; value: CustomFieldType }[] = (
  Object.keys(FIELD_TYPE_META) as CustomFieldType[]
).map((value) => ({ value, label: FIELD_TYPE_META[value].label }));

// The shared <Label> primitive is ALL CAPS app-wide; the field form opts out so
// its labels read as sentence case ("Name", not "NAME") per docs/design-system.md.
const FIELD_LABEL_CLASS = "text-xs font-medium normal-case tracking-normal";

function parseOptions(text: string): { id: string; label: string }[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label) => ({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      label,
    }));
}

interface Field {
  config: {
    max?: number;
    min?: number;
    options?: { id: string; label: string }[];
  };
  defaultValue?: unknown;
  description?: string | null;
  id: string;
  isArchived: boolean;
  name: string;
  placeholder?: string | null;
  required: boolean;
  type: CustomFieldType;
}

export function CustomFieldsSettings({
  workspaceId,
  spaceId,
  initialFields,
}: {
  initialFields: Field[];
  spaceId: string;
  workspaceId: string;
}) {
  const [fields, setFields] = React.useState(initialFields);
  const [showArchived, setShowArchived] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingField, setEditingField] = React.useState<Field | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Field | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  // How many tasks hold a value for the field being deleted — null while the
  // count is still loading, so the dialog never understates the blast radius.
  const [deleteUsage, setDeleteUsage] = React.useState<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  // Load the affected-task count whenever the delete dialog opens. On failure
  // it stays null and the dialog falls back to its generic warning.
  React.useEffect(() => {
    if (!deleteTarget) {
      setDeleteUsage(null);
      return;
    }
    let cancelled = false;
    setDeleteUsage(null);
    getCustomFieldValueCount(workspaceId, deleteTarget.id).then((res) => {
      if (!cancelled && !("error" in res)) {
        setDeleteUsage(res.count);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [deleteTarget, workspaceId]);

  async function refresh() {
    const res = await getCustomFieldDefinitions(workspaceId, spaceId, null, {
      includeArchived: true,
    });
    if (!("error" in res)) {
      setFields(res.fields as Field[]);
    }
  }

  async function handleArchiveToggle(field: Field) {
    const action = field.isArchived
      ? unarchiveCustomFieldDefinition
      : archiveCustomFieldDefinition;
    const res = await action(workspaceId, field.id);
    if (res && "error" in res) {
      toast.error(res.error);
      return;
    }
    await refresh();
  }

  async function persistOrder(next: Field[]) {
    const archived = fields.filter((f) => f.isArchived);
    setFields([...next, ...archived]);

    const res = await reorderCustomFieldDefinitions(
      workspaceId,
      spaceId,
      next.map((f) => f.id)
    );
    if (res && "error" in res) {
      toast.error(res.error);
      await refresh();
    }
  }

  // Reordering is scoped to non-archived fields — archived ones keep whatever
  // orderIndex they had when archived, same as the old Up/Down buttons.
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const nonArchivedNow = fields.filter((f) => !f.isArchived);
    const oldIndex = nonArchivedNow.findIndex((f) => f.id === active.id);
    const newIndex = nonArchivedNow.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }
    void persistOrder(arrayMove(nonArchivedNow, oldIndex, newIndex));
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    const res = await deleteCustomFieldDefinition(workspaceId, deleteTarget.id);
    setDeleting(false);
    if (res && "error" in res) {
      toast.error(res.error);
      return;
    }
    setDeleteTarget(null);
    await refresh();
  }

  function openCreate() {
    setEditingField(null);
    setFormOpen(true);
  }

  function openEdit(field: Field) {
    setEditingField(field);
    setFormOpen(true);
  }

  const nonArchived = fields.filter((f) => !f.isArchived);
  const scopedFields = fields.filter((f) => showArchived || !f.isArchived);
  const query = search.trim().toLowerCase();
  const visibleFields = query
    ? scopedFields.filter((f) => f.name.toLowerCase().includes(query))
    : scopedFields;

  return (
    <div className="space-y-4 max-w-3xl">
      <FieldFormDialog
        field={editingField}
        onOpenChange={setFormOpen}
        onSaved={refresh}
        open={formOpen}
        spaceId={spaceId}
        workspaceId={workspaceId}
      />

      <Dialog
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        open={!!deleteTarget}
      >
        <DialogContent
          className="rounded-xl text-center sm:max-w-sm"
          showCloseButton={false}
        >
          <div className="flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-red-100">
              <TrashIcon className="size-6 text-red-500" />
            </div>
          </div>
          <div className="space-y-1.5">
            <DialogTitle className="text-center text-base">
              Delete &ldquo;{deleteTarget?.name}&rdquo;?
            </DialogTitle>
            <p className="text-center text-sm leading-relaxed text-base-content/60">
              {deleteUsage === null ? (
                <>
                  This will permanently delete the field and remove all stored
                  values from every task.
                </>
              ) : deleteUsage === 0 ? (
                <>
                  This will permanently delete the field. No task has a value
                  for it yet.
                </>
              ) : (
                <>
                  This will permanently delete the field and its values from{" "}
                  <span className="font-semibold text-base-content">
                    {deleteUsage} {deleteUsage === 1 ? "task" : "tasks"}
                  </span>
                  .
                </>
              )}{" "}
              This action cannot be undone — archive the field instead to hide
              it while keeping its values.
            </p>
          </div>
          <div className="mt-1 flex gap-3">
            <Button
              className="flex-1"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={deleting}
              onClick={confirmDelete}
              variant="destructive"
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            className="w-full sm:w-56"
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search fields…"
            value={search}
          />
          <div className="flex items-center gap-2">
            <Checkbox
              checked={showArchived}
              id="show-archived"
              onCheckedChange={(v) => setShowArchived(!!v)}
            />
            <Label className="font-normal text-sm" htmlFor="show-archived">
              Show archived
            </Label>
          </div>
        </div>
        <Button className="w-full sm:w-auto" onClick={openCreate} size="sm">
          Create Field
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-base-300 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-base-200">
            <DatabaseIcon className="size-6 text-base-content/60" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">No custom fields yet</p>
            <p className="text-sm text-base-content/60">
              Create your first custom field.
            </p>
          </div>
          <Button onClick={openCreate} size="sm">
            Create Field
          </Button>
        </div>
      ) : (
        <DndContext
          collisionDetection={closestCenter}
          id="custom-fields-dnd"
          modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Field Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Required</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleFields.length === 0 && (
                <TableRow>
                  <TableCell
                    className="py-6 text-center text-base-content/60 text-sm"
                    colSpan={5}
                  >
                    No fields match &ldquo;{search}&rdquo;
                  </TableCell>
                </TableRow>
              )}
              <SortableContext
                items={nonArchived.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {visibleFields.map((field) => (
                  <FieldRow
                    field={field}
                    key={field.id}
                    onArchiveToggle={() => handleArchiveToggle(field)}
                    onDelete={() => setDeleteTarget(field)}
                    onEdit={() => openEdit(field)}
                  />
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </DndContext>
      )}
    </div>
  );
}

function FieldRow({
  field,
  onEdit,
  onArchiveToggle,
  onDelete,
}: {
  field: Field;
  onArchiveToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const meta = FIELD_TYPE_META[field.type];
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ disabled: field.isArchived, id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <TableRow
      className={cn(
        field.isArchived && "opacity-50",
        isDragging && "opacity-50"
      )}
      ref={setNodeRef}
      style={style}
    >
      <TableCell className="pr-0">
        {!field.isArchived && (
          <button
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            className="flex touch-none items-center justify-center text-base-content/40 hover:text-base-content/60 transition-colors cursor-grab active:cursor-grabbing"
            type="button"
          >
            <DotsSixVerticalIcon className="size-4" />
          </button>
        )}
      </TableCell>
      <TableCell className="font-medium">{field.name}</TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm text-base-content/60">
          <meta.icon className="size-3.5" />
          {meta.label}
        </span>
      </TableCell>
      <TableCell>
        <Badge
          className={
            field.required
              ? "rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-primary"
              : "rounded-full border border-base-300 bg-base-200 px-2 py-0.5 text-base-content/60"
          }
          variant={field.required ? "default" : "secondary"}
        >
          {field.required ? "Required" : "Optional"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-0.5">
          {!field.isArchived && (
            <button
              className="flex size-7 items-center justify-center rounded text-base-content/60 transition-colors hover:bg-base-200 hover:text-base-content"
              onClick={onEdit}
              title="Edit field"
              type="button"
            >
              <PencilSimpleIcon className="size-3.5" />
            </button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="flex size-7 items-center justify-center rounded text-base-content/60 transition-colors hover:bg-base-200 hover:text-base-content"
                title="More actions"
                type="button"
              >
                <DotsThreeIcon className="size-4" weight="bold" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-40 p-1">
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-base-200"
                onClick={onEdit}
                type="button"
              >
                <PencilSimpleIcon className="size-3.5" /> Edit
              </button>
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-base-200"
                onClick={onArchiveToggle}
                type="button"
              >
                {field.isArchived ? (
                  <>
                    <ArrowCounterClockwiseIcon className="size-3.5" /> Unarchive
                  </>
                ) : (
                  <>
                    <ArchiveIcon className="size-3.5" /> Archive
                  </>
                )}
              </button>
              <div className="my-1 h-px bg-base-300" />
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-error hover:bg-error/10"
                onClick={onDelete}
                type="button"
              >
                <TrashIcon className="size-3.5" /> Delete
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </TableCell>
    </TableRow>
  );
}

function FieldFormDialog({
  workspaceId,
  spaceId,
  field,
  open,
  onOpenChange,
  onSaved,
}: {
  field: Field | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
  open: boolean;
  spaceId: string;
  workspaceId: string;
}) {
  const isEdit = !!field;

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [placeholder, setPlaceholder] = React.useState("");
  const [type, setType] = React.useState<CustomFieldType>("TEXT");
  const [required, setRequired] = React.useState(false);
  const [optionsText, setOptionsText] = React.useState("");
  const [min, setMin] = React.useState("");
  const [max, setMax] = React.useState("");
  const [defaultValue, setDefaultValue] = React.useState<unknown>(null);
  const [dateOpen, setDateOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  // Sync local draft state whenever the dialog opens — for edit, pre-fill
  // from `field`; for create, start blank. Doesn't run on close so the form
  // doesn't visibly reset mid-close-animation.
  React.useEffect(() => {
    if (!open) {
      return;
    }
    if (field) {
      setName(field.name);
      setDescription(field.description ?? "");
      setPlaceholder(field.placeholder ?? "");
      setType(field.type);
      setRequired(field.required);
      setOptionsText(
        (field.config.options ?? []).map((o) => o.label).join(", ")
      );
      setMin(field.config.min === undefined ? "" : String(field.config.min));
      setMax(field.config.max === undefined ? "" : String(field.config.max));
      setDefaultValue(field.defaultValue ?? null);
    } else {
      setName("");
      setDescription("");
      setPlaceholder("");
      setType("TEXT");
      setRequired(false);
      setOptionsText("");
      setMin("");
      setMax("");
      setDefaultValue(null);
    }
    setError("");
  }, [open, field]);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Field name is required");
      return;
    }
    setBusy(true);
    setError("");

    const config: {
      max?: number;
      min?: number;
      options?: { id: string; label: string }[];
    } = {};
    if (type === "SINGLE_SELECT" || type === "MULTI_SELECT") {
      const options = parseOptions(optionsText);
      if (options.length === 0) {
        setError("Add at least one option");
        setBusy(false);
        return;
      }
      config.options = options;
    }
    if (type === "NUMBER") {
      if (min) {
        config.min = Number(min);
      }
      if (max) {
        config.max = Number(max);
      }
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      placeholder: placeholder.trim() || undefined,
      config,
      required,
      defaultValue,
    };

    const res = isEdit
      ? await updateCustomFieldDefinition(workspaceId, field.id, payload)
      : await createCustomFieldDefinition(workspaceId, spaceId, null, {
          ...payload,
          type,
        });

    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    onOpenChange(false);
    await onSaved();
  }

  const options = parseOptions(optionsText);

  return (
    <Dialog
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent className="rounded-xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Field" : "Create Field"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className={FIELD_LABEL_CLASS} htmlFor="cf-name">
              Name
            </Label>
            <Input
              disabled={busy}
              id="cf-name"
              onChange={(e) => setName(e.target.value)}
              value={name}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={FIELD_LABEL_CLASS} htmlFor="cf-description">
              Description
            </Label>
            <Input
              disabled={busy}
              id="cf-description"
              onChange={(e) => setDescription(e.target.value)}
              value={description}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={FIELD_LABEL_CLASS} htmlFor="cf-placeholder">
              Placeholder
            </Label>
            <Input
              disabled={busy}
              id="cf-placeholder"
              onChange={(e) => setPlaceholder(e.target.value)}
              value={placeholder}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={FIELD_LABEL_CLASS}>Type</Label>
            <Select
              disabled={busy || isEdit}
              onValueChange={(v) => {
                setType(v as CustomFieldType);
                setDefaultValue(null);
              }}
              value={type}
            >
              {/* w-full: SelectTrigger defaults to w-fit, which left this the
                  only narrow control in an otherwise full-width form. */}
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="p-1.5">
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEdit && (
              <p className="text-2xs text-base-content/60">
                Type can&rsquo;t be changed after creation.
              </p>
            )}
          </div>
          {(type === "SINGLE_SELECT" || type === "MULTI_SELECT") && (
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL_CLASS} htmlFor="cf-options">
                Options (comma separated)
              </Label>
              <Input
                disabled={busy}
                id="cf-options"
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="Low, Medium, High"
                value={optionsText}
              />
            </div>
          )}
          {type === "NUMBER" && (
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Label className={FIELD_LABEL_CLASS} htmlFor="cf-min">
                  Min
                </Label>
                <Input
                  disabled={busy}
                  id="cf-min"
                  onChange={(e) => setMin(e.target.value)}
                  type="number"
                  value={min}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className={FIELD_LABEL_CLASS} htmlFor="cf-max">
                  Max
                </Label>
                <Input
                  disabled={busy}
                  id="cf-max"
                  onChange={(e) => setMax(e.target.value)}
                  type="number"
                  value={max}
                />
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Checkbox
              checked={required}
              disabled={busy}
              id="cf-required"
              onCheckedChange={(v) => setRequired(!!v)}
            />
            <Label className="font-normal" htmlFor="cf-required">
              Required
            </Label>
          </div>

          {type === "TEXT" && (
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL_CLASS} htmlFor="cf-default-text">
                Default value
              </Label>
              <Input
                disabled={busy}
                id="cf-default-text"
                onChange={(e) => setDefaultValue(e.target.value || null)}
                value={typeof defaultValue === "string" ? defaultValue : ""}
              />
            </div>
          )}
          {type === "NUMBER" && (
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL_CLASS} htmlFor="cf-default-number">
                Default value
              </Label>
              <Input
                disabled={busy}
                id="cf-default-number"
                onChange={(e) =>
                  setDefaultValue(
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                type="number"
                value={typeof defaultValue === "number" ? defaultValue : ""}
              />
            </div>
          )}
          {type === "CHECKBOX" && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={!!defaultValue}
                disabled={busy}
                id="cf-default-checkbox"
                onCheckedChange={(v) => setDefaultValue(!!v)}
              />
              <Label className="font-normal" htmlFor="cf-default-checkbox">
                Default: {defaultValue ? "Checked" : "Unchecked"}
              </Label>
            </div>
          )}
          {type === "DATE" && (
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL_CLASS}>Default value</Label>
              <Popover onOpenChange={setDateOpen} open={dateOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="flex h-9 w-full items-center justify-between rounded-md border border-base-300 bg-base-100 px-3 text-sm"
                    disabled={busy}
                    type="button"
                  >
                    {typeof defaultValue === "string" && defaultValue ? (
                      format(new Date(defaultValue), "MMM d, yyyy")
                    ) : (
                      <span className="text-base-content/60">No default</span>
                    )}
                    <CalendarBlankIcon className="size-3.5 text-base-content/60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    onSelect={(d) => {
                      setDefaultValue(d ? d.toISOString() : null);
                      setDateOpen(false);
                    }}
                    selected={
                      typeof defaultValue === "string" && defaultValue
                        ? new Date(defaultValue)
                        : undefined
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
          {(type === "SINGLE_SELECT" || type === "MULTI_SELECT") && (
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL_CLASS}>Default value</Label>
              <div className="rounded-md border p-1.5">
                <FacetOptionList
                  emptyText="Add options above first"
                  onChange={(next) =>
                    setDefaultValue(
                      type === "SINGLE_SELECT" ? (next[0] ?? null) : next
                    )
                  }
                  options={options.map((o) => ({
                    value: o.id,
                    label: o.label,
                  }))}
                  selected={
                    type === "SINGLE_SELECT"
                      ? typeof defaultValue === "string"
                        ? [defaultValue]
                        : []
                      : Array.isArray(defaultValue)
                        ? (defaultValue as string[])
                        : []
                  }
                  single={type === "SINGLE_SELECT"}
                />
              </div>
            </div>
          )}

          {error && <p className="text-error text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            disabled={busy}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={busy || !name.trim()} onClick={handleSubmit}>
            {busy ? "Saving…" : isEdit ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
