import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit, resetRateLimitBucketsForTests } from "@/lib/rate-limit";

function buildRequest(ip: string) {
  return new Request("http://localhost/test", {
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

describe("rate limiting", () => {
  beforeEach(() => {
    resetRateLimitBucketsForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimitBucketsForTests();
  });

  it("blocks requests after the configured limit for the same IP", () => {
    const request = buildRequest("203.0.113.10");

    expect(checkRateLimit(request, { key: "login", limit: 2, windowMs: 60_000 }).allowed).toBe(true);
    expect(checkRateLimit(request, { key: "login", limit: 2, windowMs: 60_000 }).allowed).toBe(true);

    const blocked = checkRateLimit(request, { key: "login", limit: 2, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("tracks different IPs independently", () => {
    const first = buildRequest("203.0.113.10");
    const second = buildRequest("203.0.113.11");

    expect(checkRateLimit(first, { key: "login", limit: 1, windowMs: 60_000 }).allowed).toBe(true);
    expect(checkRateLimit(second, { key: "login", limit: 1, windowMs: 60_000 }).allowed).toBe(true);
    expect(checkRateLimit(first, { key: "login", limit: 1, windowMs: 60_000 }).allowed).toBe(false);
  });

  it("allows requests again after the window expires", () => {
    const request = buildRequest("203.0.113.10");

    expect(checkRateLimit(request, { key: "login", limit: 1, windowMs: 60_000 }).allowed).toBe(true);
    expect(checkRateLimit(request, { key: "login", limit: 1, windowMs: 60_000 }).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(checkRateLimit(request, { key: "login", limit: 1, windowMs: 60_000 }).allowed).toBe(true);
  });
});
