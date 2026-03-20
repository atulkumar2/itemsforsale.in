import { NextResponse } from "next/server";

import { signInAdmin } from "@/lib/auth";
import { isAdminAuthConfigured } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { adminLoginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, {
    key: "admin-login",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many login attempts. Please wait and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimit.retryAfterSeconds.toString(),
        },
      },
    );
  }

  if (process.env.NODE_ENV === "production" && !isAdminAuthConfigured()) {
    return NextResponse.json(
      {
        error: "Admin login is not configured on this deployment.",
      },
      { status: 503 },
    );
  }

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
