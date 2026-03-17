import { NextResponse } from "next/server";

import { ensureAdminApiAuth } from "@/lib/auth";
import { listAdminLeads } from "@/lib/data/repository";

function escapeCsvCell(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET(request: Request) {
  if (!(await ensureAdminApiAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const itemId = url.searchParams.get("itemId")?.trim() || undefined;
  const query = url.searchParams.get("q")?.trim() || undefined;

  const leads = await listAdminLeads({ itemId, query });

  const header = [
    "id",
    "buyerName",
    "phone",
    "email",
    "itemTitle",
    "itemSlug",
    "bidPrice",
    "message",
    "createdAt",
  ];

  const rows = leads.map((lead) =>
    [
      lead.id,
      lead.buyerName,
      lead.phone,
      lead.email,
      lead.itemTitle,
      lead.itemSlug,
      lead.bidPrice?.toString() ?? "",
      lead.message,
      lead.createdAt,
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  return new NextResponse([header.join(","), ...rows].join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="leads-export.csv"',
      "Cache-Control": "no-store",
    },
  });
}