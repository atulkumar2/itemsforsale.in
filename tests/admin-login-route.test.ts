import { afterEach, describe, expect, it, vi } from "vitest";

const signInAdminMock = vi.fn();
const isAdminAuthConfiguredMock = vi.fn();
const checkRateLimitMock = vi.fn();
const verifyContactCaptchaChallengeMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  signInAdmin: signInAdminMock,
}));

vi.mock("@/lib/contact-captcha-store", () => ({
  verifyContactCaptchaChallenge: verifyContactCaptchaChallengeMock,
}));

vi.mock("@/lib/env", () => ({
  isAdminAuthConfigured: isAdminAuthConfiguredMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

async function importRoute() {
  vi.resetModules();
  return import("@/app/api/admin/login/route");
}

function validPayload() {
  return {
    email: "admin@example.com",
    password: "secret123",
    captchaToken: "signed-token",
    captchaAnswer: "12",
  };
}

describe("admin login route", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    signInAdminMock.mockReset();
    isAdminAuthConfiguredMock.mockReset();
    checkRateLimitMock.mockReset();
    verifyContactCaptchaChallengeMock.mockReset();
  });

  it("returns 429 when rate limited", async () => {
    process.env.NODE_ENV = "test";
    checkRateLimitMock.mockReturnValue({ allowed: false, retryAfterSeconds: 120 });

    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload()),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("120");
    await expect(response.json()).resolves.toEqual({
      error: "Too many login attempts. Please wait and try again.",
    });
    expect(signInAdminMock).not.toHaveBeenCalled();
  });

  it("returns 503 in production when admin auth is not configured", async () => {
    process.env.NODE_ENV = "production";
    checkRateLimitMock.mockReturnValue({ allowed: true, retryAfterSeconds: 60 });
    isAdminAuthConfiguredMock.mockReturnValue(false);

    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload()),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Admin login is not configured on this deployment.",
    });
    expect(signInAdminMock).not.toHaveBeenCalled();
  });

  it("returns 400 when captcha verification fails", async () => {
    process.env.NODE_ENV = "test";
    checkRateLimitMock.mockReturnValue({ allowed: true, retryAfterSeconds: 60 });
    verifyContactCaptchaChallengeMock.mockReturnValue(null);

    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload()),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Captcha answer is incorrect.",
    });
    expect(signInAdminMock).not.toHaveBeenCalled();
  });
});
