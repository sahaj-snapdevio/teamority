import { describe, expect, it } from "vitest";
import type { CustomFieldRow } from "@/app/actions/custom-field";
import { filterTasks } from "./task-filter";

function makeField(overrides: Partial<CustomFieldRow>): CustomFieldRow {
  return {
    id: "field_1",
    workspaceId: "ws_1",
    spaceId: null,
    listId: null,
    name: "Field",
    slug: "field",
    description: null,
    placeholder: null,
    type: "TEXT",
    config: {},
    defaultValue: null,
    required: false,
    isArchived: false,
    archivedAt: null,
    orderIndex: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeTask(overrides: {
  title?: string;
  statusId?: string | null;
  priority?: string;
  assignees?: { userId: string }[];
  customFieldValues?: Record<string, unknown>;
}) {
  return {
    title: overrides.title ?? "Untitled",
    statusId: overrides.statusId ?? null,
    priority: overrides.priority ?? "NONE",
    assignees: overrides.assignees ?? [],
    customFieldValues: overrides.customFieldValues,
  };
}

describe("filterTasks — custom field search", () => {
  const severityField = makeField({
    id: "severity",
    name: "Severity",
    type: "SINGLE_SELECT",
    config: {
      options: [
        { id: "opt_critical", label: "Critical", color: "#EF4444" },
        { id: "opt_low", label: "Low" },
      ],
    },
  });
  const customerField = makeField({
    id: "customer",
    name: "Customer",
    type: "TEXT",
  });

  it("matches a task whose custom field value contains the search query", () => {
    const tasks = [
      makeTask({
        title: "Fix login bug",
        customFieldValues: { severity: "opt_critical" },
      }),
      makeTask({
        title: "Update docs",
        customFieldValues: { severity: "opt_low" },
      }),
    ];

    const result = filterTasks(
      tasks,
      {
        searchQuery: "critical",
        statusFilter: [],
        priorityFilter: [],
        assigneeFilter: [],
      },
      [severityField]
    );

    expect(result.map((t) => t.title)).toEqual(["Fix login bug"]);
  });

  it("matches a TEXT custom field's raw value", () => {
    const tasks = [
      makeTask({
        title: "Renew contract",
        customFieldValues: { customer: "Acme Corp" },
      }),
      makeTask({
        title: "Onboard client",
        customFieldValues: { customer: "Other Inc" },
      }),
    ];

    const result = filterTasks(
      tasks,
      {
        searchQuery: "acme",
        statusFilter: [],
        priorityFilter: [],
        assigneeFilter: [],
      },
      [customerField]
    );

    expect(result.map((t) => t.title)).toEqual(["Renew contract"]);
  });

  it("still matches on title when no custom field matches", () => {
    const tasks = [
      makeTask({ title: "Acme onboarding", customFieldValues: {} }),
    ];

    const result = filterTasks(
      tasks,
      {
        searchQuery: "acme",
        statusFilter: [],
        priorityFilter: [],
        assigneeFilter: [],
      },
      [customerField]
    );

    expect(result).toHaveLength(1);
  });
});

describe("filterTasks — custom field filters", () => {
  it("applies a custom field filter as an additional AND condition", () => {
    const tasks = [
      makeTask({
        title: "A",
        priority: "HIGH",
        customFieldValues: { severity: "opt_critical" },
      }),
      makeTask({
        title: "B",
        priority: "HIGH",
        customFieldValues: { severity: "opt_low" },
      }),
    ];

    const result = filterTasks(tasks, {
      searchQuery: "",
      statusFilter: [],
      priorityFilter: ["HIGH"],
      assigneeFilter: [],
      customFieldFilters: {
        severity: {
          type: "SINGLE_SELECT",
          operator: "equals",
          value: "opt_critical",
        },
      },
    });

    expect(result.map((t) => t.title)).toEqual(["A"]);
  });
});
