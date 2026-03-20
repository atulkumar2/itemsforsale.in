import { NextResponse } from "next/server";

import { escapeCsvCell } from "@/lib/csv";
import { listPublicItems } from "@/lib/data/repository";
import { parseItemStatus } from "@/lib/utils";

function buildOrigin(request: Request) {
  const url = new URL(request.url);

  if (url.origin) {
    return url.origin;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category")?.trim() || undefined;
  const query = url.searchParams.get("q")?.trim() || undefined;
  const status = parseItemStatus(url.searchParams.get("status") ?? undefined);

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
