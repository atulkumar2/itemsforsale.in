import { describe, expect, it } from "vitest";

import { signJsonToken, verifyJsonToken } from "@/lib/crypto-tokens";

describe("crypto tokens", () => {
  it("round-trips a signed payload", () => {
    const token = signJsonToken({ role: "admin", issuedAt: 123 }, "secret-a");

    expect(verifyJsonToken<{ role: string; issuedAt: number }>(token, "secret-a")).toEqual({
      role: "admin",
      issuedAt: 123,
    });
  });

  it("rejects tokens signed with a different secret", () => {
    const token = signJsonToken({ role: "admin" }, "secret-a");

    expect(verifyJsonToken(token, "secret-b")).toBeNull();
  });

  it("rejects malformed payloads", () => {
    expect(verifyJsonToken("not-a-token", "secret-a")).toBeNull();
  });
});
