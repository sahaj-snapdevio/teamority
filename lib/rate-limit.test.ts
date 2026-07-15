import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit, sweepRateLimitBuckets } from "@/lib/rate-limit";

let keyCounter = 0;
function uniqueKey(prefix: string): string {
  keyCounter += 1;
  return `${prefix}-${keyCounter}`;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows the first request for a fresh key", () => {
    const result = rateLimit(uniqueKey("first"), 3, 60_000);
    expect(result).toEqual({ ok: true, retryAfter: 0 });
  });

  it("allows requests up to the limit, then blocks", () => {
    const key = uniqueKey("limit");
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    const blocked = rateLimit(key, 2, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("computes retryAfter as the ceil of seconds remaining in the window", () => {
    const key = uniqueKey("retry-after");
    vi.setSystemTime(0);
    rateLimit(key, 1, 10_000); // consumes the only allowed slot
    vi.setSystemTime(3500); // 6.5s remaining until resetAt
    const blocked = rateLimit(key, 1, 10_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBe(7); // Math.ceil(6500 / 1000)
  });

  it("resets the window once resetAt has passed", () => {
    const key = uniqueKey("reset");
    vi.setSystemTime(0);
    expect(rateLimit(key, 1, 1000).ok).toBe(true);
    expect(rateLimit(key, 1, 1000).ok).toBe(false);
    vi.setSystemTime(1001);
    expect(rateLimit(key, 1, 1000).ok).toBe(true);
  });

  it("tracks separate windows per key", () => {
    const keyA = uniqueKey("a");
    const keyB = uniqueKey("b");
    expect(rateLimit(keyA, 1, 60_000).ok).toBe(true);
    expect(rateLimit(keyA, 1, 60_000).ok).toBe(false);
    expect(rateLimit(keyB, 1, 60_000).ok).toBe(true);
  });
});

describe("sweepRateLimitBuckets", () => {
  it("does not throw when called with no expired buckets", () => {
    expect(() => sweepRateLimitBuckets()).not.toThrow();
  });

  it("does not throw for an explicit future 'now' value", () => {
    expect(() => sweepRateLimitBuckets(Date.now() + 1_000_000)).not.toThrow();
  });
});
