import { NextResponse } from "next/server";

import { ensureAdminApiAuth } from "@/lib/auth";
import { listAdminContactSubmissions } from "@/lib/data/repository";

function escapeCsvCell(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET() {
  if (!(await ensureAdminApiAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const submissions = await listAdminContactSubmissions();

  const header = [
    "id",
    "buyerName",
    "phone",
    "email",
    "location",
    "message",
    "captchaPrompt",
    "createdAt",
  ];

  const rows = submissions.map((entry) =>
    [
      entry.id,
      entry.buyerName,
      entry.phone,
      entry.email,
      entry.location,
      entry.message,
      entry.captchaPrompt,
      entry.createdAt,
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contact-submissions.csv"',
      "Cache-Control": "no-store",
    },
  });
}
