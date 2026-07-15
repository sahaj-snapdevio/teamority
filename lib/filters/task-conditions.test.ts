import { describe, expect, it } from "vitest";
import {
  buildTaskFilterConditions,
  withTaskFilters,
} from "@/lib/filters/task-conditions";

// No @/lib/db mock needed: buildTaskFilterConditions only ever *builds* SQL
// (including unexecuted Drizzle subqueries for assignee/tags/sprint) — it never
// awaits a query, so the real query builder can be exercised safely with no
// network I/O.

describe("buildTaskFilterConditions", () => {
  it("returns no conditions for empty filters", () => {
    expect(buildTaskFilterConditions({})).toHaveLength(0);
  });

  it("adds one condition for a non-empty status filter", () => {
    expect(buildTaskFilterConditions({ status: ["s1"] })).toHaveLength(1);
  });

  it("ignores an empty status array", () => {
    expect(buildTaskFilterConditions({ status: [] })).toHaveLength(0);
  });

  it("adds one condition for a non-empty statusType filter", () => {
    expect(buildTaskFilterConditions({ statusType: ["OPEN"] })).toHaveLength(1);
  });

  it("adds one condition for a non-empty priority filter", () => {
    expect(buildTaskFilterConditions({ priority: ["HIGH"] })).toHaveLength(1);
  });

  describe("due", () => {
    it("adds no condition when due is the empty-string sentinel", () => {
      expect(buildTaskFilterConditions({ due: "" })).toHaveLength(0);
    });

    it("adds one condition for 'overdue'", () => {
      expect(buildTaskFilterConditions({ due: "overdue" })).toHaveLength(1);
    });

    it("adds two conditions (start/end of day) for 'today'", () => {
      expect(buildTaskFilterConditions({ due: "today" })).toHaveLength(2);
    });

    it("adds two conditions (start/end of week) for 'this_week'", () => {
      expect(buildTaskFilterConditions({ due: "this_week" })).toHaveLength(2);
    });

    it("adds one condition for 'no_due_date'", () => {
      expect(buildTaskFilterConditions({ due: "no_due_date" })).toHaveLength(1);
    });
  });

  describe("assignee", () => {
    it("ignores an empty assignee array", () => {
      expect(buildTaskFilterConditions({ assignee: [] })).toHaveLength(0);
    });

    it("adds one condition for specific user ids only", () => {
      expect(
        buildTaskFilterConditions({ assignee: ["u1", "u2"] })
      ).toHaveLength(1);
    });

    it("adds one condition for the 'unassigned' sentinel only", () => {
      expect(
        buildTaskFilterConditions({ assignee: ["unassigned"] })
      ).toHaveLength(1);
    });

    it("combines user ids and 'unassigned' into a single OR condition", () => {
      expect(
        buildTaskFilterConditions({ assignee: ["u1", "unassigned"] })
      ).toHaveLength(1);
    });
  });

  it("adds one condition for a non-empty tags filter", () => {
    expect(buildTaskFilterConditions({ tags: ["t1"] })).toHaveLength(1);
  });

  it("adds one condition for a non-empty sprint filter", () => {
    expect(buildTaskFilterConditions({ sprint: ["sprint1"] })).toHaveLength(1);
  });

  it("combines multiple independent filters additively", () => {
    expect(
      buildTaskFilterConditions({
        status: ["s1"],
        priority: ["HIGH"],
        tags: ["t1"],
      })
    ).toHaveLength(3);
  });
});

describe("withTaskFilters", () => {
  it("returns undefined when there are no base or filter conditions", () => {
    expect(withTaskFilters([], {})).toBeUndefined();
  });

  it("returns a defined SQL expression when at least one condition exists", () => {
    expect(withTaskFilters([], { status: ["s1"] })).toBeDefined();
  });

  it("combines base conditions with filter conditions", () => {
    const [baseCondition] = buildTaskFilterConditions({ priority: ["HIGH"] });
    expect(withTaskFilters([baseCondition], { status: ["s1"] })).toBeDefined();
  });
});
