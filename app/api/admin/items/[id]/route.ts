import { NextResponse } from "next/server";

import { ensureAdminApiAuth } from "@/lib/auth";
import { deleteAdminItem } from "@/lib/data/repository";

type DeleteItemRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_request: Request, { params }: DeleteItemRouteProps) {
  if (!(await ensureAdminApiAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  await deleteAdminItem(id);
  return NextResponse.json({ message: "Item deleted." });
}