import { afterEach, describe, expect, it, vi } from "vitest";

const getAdminItemByIdMock = vi.fn();
const submitLeadMock = vi.fn();
const checkRateLimitMock = vi.fn();

vi.mock("@/lib/data/repository", () => ({
  getAdminItemById: getAdminItemByIdMock,
  submitLead: submitLeadMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

async function importRoute() {
  vi.resetModules();
  return import("@/app/api/leads/route");
}

describe("leads route", () => {
  afterEach(() => {
    getAdminItemByIdMock.mockReset();
    submitLeadMock.mockReset();
    checkRateLimitMock.mockReset();
  });

  it("returns 429 when enquiry submissions are rate limited", async () => {
    checkRateLimitMock.mockReturnValue({ allowed: false, retryAfterSeconds: 45 });

    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: "064b9d22-f5d1-4fcb-9237-7b6ba8123401",
          buyerName: "Atul Kumar",
          phone: "9876543210",
          email: "itemsforsale@outlook.in",
          message: "I am interested in this item and would like to visit this week.",
          bidPrice: "12000",
        }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("45");
    await expect(response.json()).resolves.toEqual({
      error: "Too many enquiries. Please wait and try again.",
    });
    expect(getAdminItemByIdMock).not.toHaveBeenCalled();
    expect(submitLeadMock).not.toHaveBeenCalled();
  });
});
