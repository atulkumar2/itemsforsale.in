import { NextResponse } from "next/server";

import { verifyContactCaptchaChallenge } from "@/lib/contact-captcha-store";
import { getAdminItemById, submitLead } from "@/lib/data/repository";
import { isCaptchaConfigured } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { bulkInterestFormSchema } from "@/lib/validation";

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
    key: "bulk-lead-submissions",
    limit: 6,
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

  const body = (await request.json()) as {
    itemIds?: string[];
    buyerName?: string;
    phone?: string;
    email?: string;
    message?: string;
    captchaToken?: string;
    captchaAnswer?: string;
  };
  const parsed = bulkInterestFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid bulk interest payload.",
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

  const uniqueItemIds = Array.from(new Set(parsed.data.itemIds));
  const items = await Promise.all(uniqueItemIds.map((itemId) => getAdminItemById(itemId)));
  const missingItem = items.find((item) => !item);

  if (missingItem !== undefined) {
    return NextResponse.json(
      {
        error: "One or more selected items could not be found.",
      },
      { status: 404 },
    );
  }

  await Promise.all(
    uniqueItemIds.map((itemId) =>
      submitLead({
        itemId,
        buyerName: parsed.data.buyerName,
        phone: parsed.data.phone,
        email: parsed.data.email,
        message: parsed.data.message,
      }),
    ),
  );

  return NextResponse.json(
    {
      message: `Interest submitted for ${uniqueItemIds.length} item${uniqueItemIds.length === 1 ? "" : "s"}.`,
    },
    { status: 201 },
  );
}
