import { afterEach, describe, expect, it, vi } from "vitest";

const issueContactCaptchaChallengeMock = vi.fn();
const isCaptchaConfiguredMock = vi.fn();

vi.mock("@/lib/contact-captcha-store", () => ({
  issueContactCaptchaChallenge: issueContactCaptchaChallengeMock,
}));

vi.mock("@/lib/env", () => ({
  isCaptchaConfigured: isCaptchaConfiguredMock,
}));

async function importRoute() {
  vi.resetModules();
  return import("@/app/api/human-check/route");
}

describe("human check route", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    issueContactCaptchaChallengeMock.mockReset();
    isCaptchaConfiguredMock.mockReset();
  });

  it("returns 503 in production when captcha is not configured", async () => {
    process.env.NODE_ENV = "production";
    isCaptchaConfiguredMock.mockReturnValue(false);

    const { GET } = await importRoute();
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Captcha is not configured on this deployment.",
    });
  });

  it("returns a no-store challenge payload when configured", async () => {
    process.env.NODE_ENV = "test";
    issueContactCaptchaChallengeMock.mockReturnValue({
      prompt: "What is 7 + 5?",
      token: "signed-token",
    });

    const { GET } = await importRoute();
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      prompt: "What is 7 + 5?",
      token: "signed-token",
    });
  });
});
