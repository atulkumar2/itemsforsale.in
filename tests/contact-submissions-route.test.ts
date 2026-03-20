import { afterEach, describe, expect, it, vi } from "vitest";

const issueContactCaptchaChallengeMock = vi.fn();
const verifyContactCaptchaChallengeMock = vi.fn();
const submitContactSubmissionMock = vi.fn();
const isCaptchaConfiguredMock = vi.fn();
const checkRateLimitMock = vi.fn();

vi.mock("@/lib/contact-captcha-store", () => ({
  issueContactCaptchaChallenge: issueContactCaptchaChallengeMock,
  verifyContactCaptchaChallenge: verifyContactCaptchaChallengeMock,
}));

vi.mock("@/lib/data/repository", () => ({
  submitContactSubmission: submitContactSubmissionMock,
}));

vi.mock("@/lib/env", () => ({
  isCaptchaConfigured: isCaptchaConfiguredMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

async function importRoute() {
  vi.resetModules();
  return import("@/app/api/contact-submissions/route");
}

function validPayload() {
  return {
    buyerName: "Atul Kumar",
    phone: "9876543210",
    email: "itemsforsale@outlook.in",
    location: "Bommanahalli",
    message: "I am interested in your dining set. Please share available timing.",
    captchaToken: "signed-token",
    captchaAnswer: "12",
  };
}

describe("contact submissions route", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    issueContactCaptchaChallengeMock.mockReset();
    verifyContactCaptchaChallengeMock.mockReset();
    submitContactSubmissionMock.mockReset();
    isCaptchaConfiguredMock.mockReset();
    checkRateLimitMock.mockReset();
  });

  it("returns 503 for GET in production when captcha is not configured", async () => {
    process.env.NODE_ENV = "production";
    isCaptchaConfiguredMock.mockReturnValue(false);

    const { GET } = await importRoute();
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Captcha is not configured on this deployment.",
    });
    expect(issueContactCaptchaChallengeMock).not.toHaveBeenCalled();
  });

  it("returns 503 for POST in production when captcha is not configured", async () => {
    process.env.NODE_ENV = "production";
    isCaptchaConfiguredMock.mockReturnValue(false);

    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/contact-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload()),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Captcha is not configured on this deployment.",
    });
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(submitContactSubmissionMock).not.toHaveBeenCalled();
  });

  it("returns 429 for POST when rate limited", async () => {
    process.env.NODE_ENV = "test";
    checkRateLimitMock.mockReturnValue({ allowed: false, retryAfterSeconds: 90 });

    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/contact-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload()),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("90");
    await expect(response.json()).resolves.toEqual({
      error: "Too many contact requests. Please wait and try again.",
    });
    expect(verifyContactCaptchaChallengeMock).not.toHaveBeenCalled();
    expect(submitContactSubmissionMock).not.toHaveBeenCalled();
  });
});
