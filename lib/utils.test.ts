import { describe, expect, it, vi } from "vitest";
import { cn, formatDateTime, sleep } from "@/lib/utils";

describe("cn", () => {
  it("merges plain class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("lets the last conflicting Tailwind utility win", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("drops falsy values", () => {
    const isHidden = false;
    expect(cn("a", isHidden && "b", undefined, null, "c")).toBe("a c");
  });
});

describe("sleep", () => {
  it("resolves only after the given delay has elapsed", async () => {
    vi.useFakeTimers();
    try {
      let resolved = false;
      sleep(1000).then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(999);
      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(resolved).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("formatDateTime", () => {
  it.each([null, undefined])("returns 'Never' for %s", (value) => {
    expect(formatDateTime(value)).toBe("Never");
  });

  it("formats a Date using the en locale medium/short style", () => {
    const date = new Date("2024-03-15T14:30:00Z");
    const expected = new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
    expect(formatDateTime(date)).toBe(expected);
  });

  it("coerces a string to a Date, formatting identically to the equivalent Date", () => {
    const iso = "2024-03-15T14:30:00Z";
    expect(formatDateTime(iso)).toBe(formatDateTime(new Date(iso)));
  });
});
