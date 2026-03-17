import { NextResponse } from "next/server";

import { ensureAdminApiAuth } from "@/lib/auth";
import { saveAdminItem } from "@/lib/data/repository";
import {
  normaliseOptionalString,
  parseOptionalDate,
  parseOptionalNumber,
} from "@/lib/utils";
import { itemFormSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!(await ensureAdminApiAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const formData = await request.formData();
  const parsed = itemFormSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? ""),
    condition: String(formData.get("condition") ?? ""),
    purchaseDate: String(formData.get("purchaseDate") ?? ""),
    purchasePrice: String(formData.get("purchasePrice") ?? ""),
    expectedPrice: String(formData.get("expectedPrice") ?? ""),
    availableFrom: String(formData.get("availableFrom") ?? ""),
    locationArea: String(formData.get("locationArea") ?? ""),
    status: String(formData.get("status") ?? "available"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid item payload.",
      },
      { status: 400 },
    );
  }

  const files = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);

  const savedItem = await saveAdminItem(
    {
      id: normaliseOptionalString(parsed.data.id),
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      condition: parsed.data.condition,
      purchaseDate: parseOptionalDate(parsed.data.purchaseDate),
      purchasePrice: parseOptionalNumber(parsed.data.purchasePrice),
      expectedPrice: parseOptionalNumber(parsed.data.expectedPrice),
      availableFrom: parseOptionalDate(parsed.data.availableFrom),
      locationArea: parsed.data.locationArea,
      status: parsed.data.status,
    },
    files,
  );

  return NextResponse.json({
    itemId: savedItem?.id,
    message: "Item saved successfully.",
  });
}