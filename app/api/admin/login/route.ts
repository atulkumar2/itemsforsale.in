import { NextResponse } from "next/server";

import { signInAdmin } from "@/lib/auth";
import { adminLoginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, string>;
  const parsed = adminLoginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid login payload.",
      },
      { status: 400 },
    );
  }

  const signedIn = await signInAdmin(parsed.data.email, parsed.data.password);
  if (!signedIn) {
    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }

  return NextResponse.json({ message: "Login successful." });
}