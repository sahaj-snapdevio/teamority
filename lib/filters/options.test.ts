import { describe, expect, it } from "vitest";
import {
  type GlobalSearchFilters,
  hasActiveFilters,
  toggle,
} from "@/lib/filters/options";

describe("toggle", () => {
  it("adds the value when the array is undefined", () => {
    expect(toggle(undefined, "a")).toEqual(["a"]);
  });

  it("adds the value when it isn't already present", () => {
    expect(toggle(["a"], "b")).toEqual(["a", "b"]);
  });

  it("removes the value when it is already present", () => {
    expect(toggle(["a", "b"], "b")).toEqual(["a"]);
  });

  it("does not mutate the input array", () => {
    const original = ["a", "b"];
    toggle(original, "b");
    expect(original).toEqual(["a", "b"]);
  });
});

describe("hasActiveFilters", () => {
  it("returns false for undefined filters", () => {
    expect(hasActiveFilters(undefined)).toBe(false);
  });

  it("returns false for an empty filter object", () => {
    expect(hasActiveFilters({})).toBe(false);
  });

  it("returns false when type is explicitly 'all'", () => {
    expect(hasActiveFilters({ type: "all" })).toBe(false);
  });

  it("returns true when type is set to a specific entity", () => {
    expect(hasActiveFilters({ type: "tasks" })).toBe(true);
  });

  it("returns false for empty array fields", () => {
    const filters: GlobalSearchFilters = {
      statusType: [],
      status: [],
      priority: [],
      assignee: [],
      space: [],
      sprint: [],
      tags: [],
    };
    expect(hasActiveFilters(filters)).toBe(false);
  });

  it("returns true when statusType has at least one value", () => {
    expect(hasActiveFilters({ statusType: ["OPEN"] })).toBe(true);
  });

  it("returns true when status has at least one value", () => {
    expect(hasActiveFilters({ status: ["s1"] })).toBe(true);
  });

  it("returns true when priority has at least one value", () => {
    expect(hasActiveFilters({ priority: ["HIGH"] })).toBe(true);
  });

  it("returns true when assignee has at least one value", () => {
    expect(hasActiveFilters({ assignee: ["u1"] })).toBe(true);
  });

  it("returns true when space has at least one value", () => {
    expect(hasActiveFilters({ space: ["sp1"] })).toBe(true);
  });

  it("returns true when sprint has at least one value", () => {
    expect(hasActiveFilters({ sprint: ["sprint1"] })).toBe(true);
  });

  it("returns true when tags has at least one value", () => {
    expect(hasActiveFilters({ tags: ["t1"] })).toBe(true);
  });

  it("returns true when due is set to a non-empty value", () => {
    expect(hasActiveFilters({ due: "overdue" })).toBe(true);
  });

  it("returns false when due is the empty-string sentinel", () => {
    expect(hasActiveFilters({ due: "" })).toBe(false);
  });
});
