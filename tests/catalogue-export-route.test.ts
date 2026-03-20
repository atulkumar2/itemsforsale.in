import { afterEach, describe, expect, it, vi } from "vitest";

const checkRateLimitMock = vi.fn();
const listPublicItemsMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/lib/data/repository", () => ({
  listPublicItems: listPublicItemsMock,
}));

async function importRoute() {
  vi.resetModules();
  return import("@/app/api/catalogue/export/route");
}

describe("catalogue export route", () => {
  afterEach(() => {
    checkRateLimitMock.mockReset();
    listPublicItemsMock.mockReset();
  });

  it("returns 429 when public catalogue exports are rate limited", async () => {
    checkRateLimitMock.mockReturnValue({ allowed: false, retryAfterSeconds: 45 });

    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/catalogue/export"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("45");
    await expect(response.json()).resolves.toEqual({
      error: "Too many catalogue exports. Please wait and try again.",
    });
    expect(listPublicItemsMock).not.toHaveBeenCalled();
  });

  it("returns 400 when status filter is invalid", async () => {
    checkRateLimitMock.mockReturnValue({ allowed: true, retryAfterSeconds: 45 });

    const { GET } = await importRoute();
    const response = await GET(
      new Request("http://localhost/api/catalogue/export?status=broken"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Status filter must be one of: available, reserved, sold.",
    });
    expect(listPublicItemsMock).not.toHaveBeenCalled();
  });

  it("returns csv when filters are valid", async () => {
    checkRateLimitMock.mockReturnValue({ allowed: true, retryAfterSeconds: 45 });
    listPublicItemsMock.mockResolvedValue([
      {
        id: "064b9d22-f5d1-4fcb-9237-7b6ba8123401",
        title: "Dining Table",
        slug: "dining-table",
        status: "available",
        category: "Dining",
        condition: "Good",
        expectedPrice: 12000,
        locationArea: "Bommanahalli",
        updatedAt: "2026-03-20T12:00:00.000Z",
      },
    ]);

    const { GET } = await importRoute();
    const response = await GET(
      new Request("http://localhost/api/catalogue/export?status=available&q=table"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    const body = await response.text();
    expect(body).toContain("itemLink");
    expect(body).toContain("http://localhost/items/dining-table");
    expect(listPublicItemsMock).toHaveBeenCalledWith({
      category: undefined,
      query: "table",
      status: "available",
    });
  });
});
