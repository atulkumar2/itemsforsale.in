import { NextResponse } from "next/server";

import { getAdminItemById, submitLead } from "@/lib/data/repository";
import { parseOptionalNumber } from "@/lib/utils";
import { interestFormSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, string>;
  const parsed = interestFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid lead payload.",
      },
      { status: 400 },
    );
  }

  const item = await getAdminItemById(parsed.data.itemId);
  if (!item) {
    return NextResponse.json({ error: "The selected item could not be found." }, { status: 404 });
  }

  await submitLead({
    itemId: parsed.data.itemId,
    buyerName: parsed.data.buyerName,
    phone: parsed.data.phone,
    email: parsed.data.email,
    message: parsed.data.message,
    bidPrice: parseOptionalNumber(parsed.data.bidPrice),
  });

  return NextResponse.json(
    {
      message: "Interest submitted successfully.",
    },
    { status: 201 },
  );
}