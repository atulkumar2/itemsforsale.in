import { NextResponse } from "next/server";

import { escapeCsvCell } from "@/lib/csv";
import { itemFormLimits, itemStatuses } from "@/lib/constants";
import { listPublicItems } from "@/lib/data/repository";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseItemStatus } from "@/lib/utils";

function buildOrigin(request: Request) {
  const url = new URL(request.url);

  if (url.origin) {
    return url.origin;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, {
    key: "catalogue-export",
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many catalogue exports. Please wait and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimit.retryAfterSeconds.toString(),
        },
      },
    );
  }

  const url = new URL(request.url);
  const rawCategory = url.searchParams.get("category")?.trim() || undefined;
  const rawQuery = url.searchParams.get("q")?.trim() || undefined;
  const rawStatus = url.searchParams.get("status")?.trim() || undefined;

  if (rawCategory && rawCategory.length > itemFormLimits.categoryMax) {
    return NextResponse.json(
      {
        error: "Category filter is too long.",
      },
      { status: 400 },
    );
  }

  if (rawQuery && rawQuery.length > itemFormLimits.titleMax) {
    return NextResponse.json(
      {
        error: "Search query is too long.",
      },
      { status: 400 },
    );
  }

  const status = parseItemStatus(rawStatus);

  if (rawStatus && !status) {
    return NextResponse.json(
      {
        error: `Status filter must be one of: ${itemStatuses.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const category = rawCategory;
  const query = rawQuery;

  const items = await listPublicItems({
    category,
    query,
    status,
  });

  const origin = buildOrigin(request);

  const header = [
    "id",
    "title",
    "status",
    "category",
    "condition",
    "expectedPrice",
    "locationArea",
    "updatedAt",
    "itemLink",
  ];

  const rows = items.map((item) =>
    [
      item.id,
      item.title,
      item.status,
      item.category,
      item.condition,
      item.expectedPrice?.toString() ?? "",
      item.locationArea,
      item.updatedAt,
      `${origin}/items/${item.slug}`,
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="catalogue-export.csv"',
      "Cache-Control": "no-store",
    },
  });
}
