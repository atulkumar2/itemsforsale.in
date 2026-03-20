import { afterEach, describe, expect, it, vi } from "vitest";

const getAdminItemByIdMock = vi.fn();
const submitLeadMock = vi.fn();
const checkRateLimitMock = vi.fn();
const verifyContactCaptchaChallengeMock = vi.fn();
const isCaptchaConfiguredMock = vi.fn();

vi.mock("@/lib/data/repository", () => ({
  getAdminItemById: getAdminItemByIdMock,
  submitLead: submitLeadMock,
}));

vi.mock("@/lib/contact-captcha-store", () => ({
  verifyContactCaptchaChallenge: verifyContactCaptchaChallengeMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/lib/env", () => ({
  isCaptchaConfigured: isCaptchaConfiguredMock,
}));

async function importRoute() {
  vi.resetModules();
  return import("@/app/api/bulk-leads/route");
}

function validPayload() {
  return {
    itemIds: [
      "064b9d22-f5d1-4fcb-9237-7b6ba8123401",
      "164b9d22-f5d1-4fcb-9237-7b6ba8123402",
    ],
    buyerName: "Atul Kumar",
    phone: "9876543210",
    email: "itemsforsale@outlook.in",
    message: "I am interested in these items and would like to inspect them this week.",
    captchaToken: "signed-token",
    captchaAnswer: "12",
  };
}

describe("bulk leads route", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    getAdminItemByIdMock.mockReset();
    submitLeadMock.mockReset();
    checkRateLimitMock.mockReset();
    verifyContactCaptchaChallengeMock.mockReset();
    isCaptchaConfiguredMock.mockReset();
  });

  it("returns 429 when bulk submissions are rate limited", async () => {
    process.env.NODE_ENV = "test";
    checkRateLimitMock.mockReturnValue({ allowed: false, retryAfterSeconds: 45 });

    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/bulk-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload()),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("45");
    await expect(response.json()).resolves.toEqual({
      error: "Too many enquiries. Please wait and try again.",
    });
  });

  it("returns 400 when captcha verification fails", async () => {
    process.env.NODE_ENV = "test";
    checkRateLimitMock.mockReturnValue({ allowed: true, retryAfterSeconds: 45 });
    verifyContactCaptchaChallengeMock.mockReturnValue(null);

    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/bulk-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload()),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Captcha answer is incorrect.",
    });
    expect(submitLeadMock).not.toHaveBeenCalled();
  });

  it("creates one lead per selected item when valid", async () => {
    process.env.NODE_ENV = "test";
    checkRateLimitMock.mockReturnValue({ allowed: true, retryAfterSeconds: 45 });
    verifyContactCaptchaChallengeMock.mockReturnValue({ prompt: "What is 7 + 5?" });
    getAdminItemByIdMock.mockResolvedValue({ id: "item-id" });

    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/bulk-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload()),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      message: "Interest submitted for 2 items.",
    });
    expect(getAdminItemByIdMock).toHaveBeenCalledTimes(2);
    expect(submitLeadMock).toHaveBeenCalledTimes(2);
    expect(submitLeadMock).toHaveBeenNthCalledWith(1, {
      itemId: "064b9d22-f5d1-4fcb-9237-7b6ba8123401",
      buyerName: "Atul Kumar",
      phone: "9876543210",
      email: "itemsforsale@outlook.in",
      message: "I am interested in these items and would like to inspect them this week.",
    });
  });
});
