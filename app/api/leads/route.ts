import { NextResponse } from "next/server";

import { verifyContactCaptchaChallenge } from "@/lib/contact-captcha-store";
import { getAdminItemById, submitLead } from "@/lib/data/repository";
import { isCaptchaConfigured } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseOptionalNumber } from "@/lib/utils";
import { interestFormSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && !isCaptchaConfigured()) {
    return NextResponse.json(
      {
        error: "Captcha is not configured on this deployment.",
      },
      { status: 503 },
    );
  }

  const rateLimit = checkRateLimit(request, {
    key: "lead-submissions",
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many enquiries. Please wait and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimit.retryAfterSeconds.toString(),
        },
      },
    );
  }

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

  const verifiedChallenge = verifyContactCaptchaChallenge(
    parsed.data.captchaToken,
    parsed.data.captchaAnswer,
  );

  if (!verifiedChallenge) {
    return NextResponse.json(
      {
        error: "Captcha answer is incorrect.",
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
    location: parsed.data.location,
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
