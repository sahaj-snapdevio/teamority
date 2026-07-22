import { describe, expect, it } from "vitest";
import {
  hasActiveCustomFieldFilters,
  isCustomFieldFilterActive,
  matchesCustomFieldFilter,
  matchesCustomFieldFilters,
} from "./filters";

describe("matchesCustomFieldFilter — TEXT", () => {
  it("contains matches a case-insensitive substring", () => {
    expect(
      matchesCustomFieldFilter("Acme Corp", {
        type: "TEXT",
        operator: "contains",
        value: "acme",
      })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter("Other Corp", {
        type: "TEXT",
        operator: "contains",
        value: "acme",
      })
    ).toBe(false);
  });

  it("equals requires an exact case-insensitive match", () => {
    expect(
      matchesCustomFieldFilter("Acme", {
        type: "TEXT",
        operator: "equals",
        value: "acme",
      })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter("Acme Corp", {
        type: "TEXT",
        operator: "equals",
        value: "acme",
      })
    ).toBe(false);
  });

  it("starts_with / ends_with anchor the match", () => {
    expect(
      matchesCustomFieldFilter("Acme Corp", {
        type: "TEXT",
        operator: "starts_with",
        value: "acme",
      })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter("Corp Acme", {
        type: "TEXT",
        operator: "starts_with",
        value: "acme",
      })
    ).toBe(false);
    expect(
      matchesCustomFieldFilter("Corp Acme", {
        type: "TEXT",
        operator: "ends_with",
        value: "acme",
      })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter("Acme Corp", {
        type: "TEXT",
        operator: "ends_with",
        value: "acme",
      })
    ).toBe(false);
  });

  it("is_empty / is_not_empty check for a blank value", () => {
    expect(
      matchesCustomFieldFilter(null, { type: "TEXT", operator: "is_empty" })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter("", { type: "TEXT", operator: "is_empty" })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter("x", { type: "TEXT", operator: "is_empty" })
    ).toBe(false);
    expect(
      matchesCustomFieldFilter("x", { type: "TEXT", operator: "is_not_empty" })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter(null, { type: "TEXT", operator: "is_not_empty" })
    ).toBe(false);
  });
});

describe("matchesCustomFieldFilter — NUMBER", () => {
  it("supports every comparison operator", () => {
    expect(
      matchesCustomFieldFilter(5, { type: "NUMBER", operator: "eq", value: 5 })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter(5, { type: "NUMBER", operator: "ne", value: 3 })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter(5, { type: "NUMBER", operator: "ne", value: 5 })
    ).toBe(false);
    expect(
      matchesCustomFieldFilter(5, { type: "NUMBER", operator: "gt", value: 3 })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter(5, { type: "NUMBER", operator: "lt", value: 3 })
    ).toBe(false);
    expect(
      matchesCustomFieldFilter(5, { type: "NUMBER", operator: "gte", value: 5 })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter(5, { type: "NUMBER", operator: "lte", value: 5 })
    ).toBe(true);
  });

  it("between requires both bounds", () => {
    expect(
      matchesCustomFieldFilter(5, {
        type: "NUMBER",
        operator: "between",
        value: 1,
        valueMax: 10,
      })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter(15, {
        type: "NUMBER",
        operator: "between",
        value: 1,
        valueMax: 10,
      })
    ).toBe(false);
  });

  it("is_empty / is_not_empty check for a missing/non-numeric value", () => {
    expect(
      matchesCustomFieldFilter(null, { type: "NUMBER", operator: "is_empty" })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter(5, { type: "NUMBER", operator: "is_empty" })
    ).toBe(false);
    expect(
      matchesCustomFieldFilter(5, { type: "NUMBER", operator: "is_not_empty" })
    ).toBe(true);
  });

  it("treats an empty/non-numeric value as no match for comparison operators", () => {
    expect(
      matchesCustomFieldFilter(null, {
        type: "NUMBER",
        operator: "eq",
        value: 5,
      })
    ).toBe(false);
    expect(
      matchesCustomFieldFilter("abc", {
        type: "NUMBER",
        operator: "eq",
        value: 5,
      })
    ).toBe(false);
  });
});

describe("matchesCustomFieldFilter — DATE", () => {
  it("before/after/on compare against the given date", () => {
    const value = "2026-06-15T00:00:00.000Z";
    expect(
      matchesCustomFieldFilter(value, {
        type: "DATE",
        operator: "before",
        value: "2026-07-01",
      })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter(value, {
        type: "DATE",
        operator: "after",
        value: "2026-07-01",
      })
    ).toBe(false);
    expect(
      matchesCustomFieldFilter(value, {
        type: "DATE",
        operator: "on",
        value: "2026-06-15",
      })
    ).toBe(true);
  });

  it("between checks an inclusive range", () => {
    const value = "2026-06-15T00:00:00.000Z";
    expect(
      matchesCustomFieldFilter(value, {
        type: "DATE",
        operator: "between",
        value: "2026-06-01",
        valueMax: "2026-06-30",
      })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter(value, {
        type: "DATE",
        operator: "between",
        value: "2026-07-01",
        valueMax: "2026-07-30",
      })
    ).toBe(false);
  });

  it("is_empty checks for a missing date", () => {
    expect(
      matchesCustomFieldFilter(null, { type: "DATE", operator: "is_empty" })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter("2026-06-15T00:00:00.000Z", {
        type: "DATE",
        operator: "is_empty",
      })
    ).toBe(false);
  });

  it("returns false for a non-empty operator against an empty value", () => {
    expect(
      matchesCustomFieldFilter(null, {
        type: "DATE",
        operator: "before",
        value: "2026-07-01",
      })
    ).toBe(false);
  });
});

describe("matchesCustomFieldFilter — CHECKBOX", () => {
  it("matches checked/unchecked", () => {
    expect(
      matchesCustomFieldFilter(true, { type: "CHECKBOX", operator: "checked" })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter(false, { type: "CHECKBOX", operator: "checked" })
    ).toBe(false);
    expect(
      matchesCustomFieldFilter(false, {
        type: "CHECKBOX",
        operator: "unchecked",
      })
    ).toBe(true);
  });
});

describe("matchesCustomFieldFilter — SINGLE_SELECT", () => {
  it("equals / not_equals compare against one option id", () => {
    expect(
      matchesCustomFieldFilter("opt_critical", {
        type: "SINGLE_SELECT",
        operator: "equals",
        value: "opt_critical",
      })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter("opt_low", {
        type: "SINGLE_SELECT",
        operator: "equals",
        value: "opt_critical",
      })
    ).toBe(false);
    expect(
      matchesCustomFieldFilter("opt_low", {
        type: "SINGLE_SELECT",
        operator: "not_equals",
        value: "opt_critical",
      })
    ).toBe(true);
  });

  it("is_empty / is_not_empty check for no option set", () => {
    expect(
      matchesCustomFieldFilter(null, {
        type: "SINGLE_SELECT",
        operator: "is_empty",
      })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter("opt_critical", {
        type: "SINGLE_SELECT",
        operator: "is_not_empty",
      })
    ).toBe(true);
  });
});

describe("matchesCustomFieldFilter — MULTI_SELECT", () => {
  it("contains_any matches on ANY overlap", () => {
    expect(
      matchesCustomFieldFilter(["opt_a", "opt_b"], {
        type: "MULTI_SELECT",
        operator: "contains_any",
        value: ["opt_b", "opt_c"],
      })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter(["opt_a"], {
        type: "MULTI_SELECT",
        operator: "contains_any",
        value: ["opt_b", "opt_c"],
      })
    ).toBe(false);
  });

  it("contains_all requires every selected option to be present", () => {
    expect(
      matchesCustomFieldFilter(["opt_a", "opt_b", "opt_c"], {
        type: "MULTI_SELECT",
        operator: "contains_all",
        value: ["opt_a", "opt_b"],
      })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter(["opt_a"], {
        type: "MULTI_SELECT",
        operator: "contains_all",
        value: ["opt_a", "opt_b"],
      })
    ).toBe(false);
  });

  it("not_contains excludes any overlap", () => {
    expect(
      matchesCustomFieldFilter(["opt_a"], {
        type: "MULTI_SELECT",
        operator: "not_contains",
        value: ["opt_b"],
      })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter(["opt_a", "opt_b"], {
        type: "MULTI_SELECT",
        operator: "not_contains",
        value: ["opt_b"],
      })
    ).toBe(false);
  });
});

describe("matchesCustomFieldFilter — PERSON", () => {
  it("is / is_not compare against one user id", () => {
    expect(
      matchesCustomFieldFilter("user_1", {
        type: "PERSON",
        operator: "is",
        value: "user_1",
      })
    ).toBe(true);
    expect(
      matchesCustomFieldFilter("user_2", {
        type: "PERSON",
        operator: "is",
        value: "user_1",
      })
    ).toBe(false);
    expect(
      matchesCustomFieldFilter("user_2", {
        type: "PERSON",
        operator: "is_not",
        value: "user_1",
      })
    ).toBe(true);
  });
});

describe("matchesCustomFieldFilters", () => {
  it("requires every active field filter to match (AND across fields)", () => {
    const values = { severity: "opt_critical", storyPoints: 8 };
    const filters = {
      severity: {
        type: "SINGLE_SELECT" as const,
        operator: "equals" as const,
        value: "opt_critical",
      },
      storyPoints: {
        type: "NUMBER" as const,
        operator: "gte" as const,
        value: 5,
      },
    };
    expect(matchesCustomFieldFilters(values, filters)).toBe(true);

    expect(
      matchesCustomFieldFilters(values, {
        ...filters,
        storyPoints: {
          type: "NUMBER" as const,
          operator: "gte" as const,
          value: 10,
        },
      })
    ).toBe(false);
  });

  it("passes through when there are no filters", () => {
    expect(matchesCustomFieldFilters({ a: 1 }, undefined)).toBe(true);
    expect(matchesCustomFieldFilters({ a: 1 }, {})).toBe(true);
  });
});

describe("isCustomFieldFilterActive / hasActiveCustomFieldFilters", () => {
  it("is false for undefined and value-less operators still awaiting a value", () => {
    expect(isCustomFieldFilterActive(undefined)).toBe(false);
    expect(
      isCustomFieldFilterActive({ type: "SINGLE_SELECT", operator: "equals" })
    ).toBe(false);
    expect(
      isCustomFieldFilterActive({
        type: "MULTI_SELECT",
        operator: "contains_any",
      })
    ).toBe(false);
  });

  it("is true once a value or a value-less operator (is_empty, today, checked, …) is set", () => {
    expect(
      isCustomFieldFilterActive({
        type: "SINGLE_SELECT",
        operator: "equals",
        value: "opt_1",
      })
    ).toBe(true);
    expect(
      isCustomFieldFilterActive({ type: "NUMBER", operator: "eq", value: 5 })
    ).toBe(true);
    expect(isCustomFieldFilterActive({ type: "DATE", operator: "today" })).toBe(
      true
    );
    expect(
      isCustomFieldFilterActive({ type: "CHECKBOX", operator: "checked" })
    ).toBe(true);
    expect(
      isCustomFieldFilterActive({ type: "TEXT", operator: "is_empty" })
    ).toBe(true);
  });

  it("hasActiveCustomFieldFilters reflects whether any field is active", () => {
    expect(hasActiveCustomFieldFilters(undefined)).toBe(false);
    expect(hasActiveCustomFieldFilters({})).toBe(false);
    expect(
      hasActiveCustomFieldFilters({
        severity: { type: "SINGLE_SELECT", operator: "equals" },
      })
    ).toBe(false);
    expect(
      hasActiveCustomFieldFilters({
        severity: { type: "SINGLE_SELECT", operator: "equals", value: "opt_1" },
      })
    ).toBe(true);
  });
});
