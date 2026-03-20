import { NextResponse } from "next/server";

import { issueContactCaptchaChallenge, verifyContactCaptchaChallenge } from "@/lib/contact-captcha-store";
import { submitContactSubmission } from "@/lib/data/repository";
import { isCaptchaConfigured } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { contactSellerSchema } from "@/lib/validation";

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
    key: "contact-submissions",
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many contact requests. Please wait and try again.",
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
  const parsed = contactSellerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid contact request.",
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

  await submitContactSubmission({
    buyerName: parsed.data.buyerName,
    phone: parsed.data.phone,
    email: parsed.data.email,
    location: parsed.data.location,
    message: parsed.data.message,
    captchaPrompt: verifiedChallenge.prompt,
  });

  return NextResponse.json(
    {
      message: "Contact request submitted successfully.",
    },
    { status: 201 },
  );
}

export async function GET() {
  if (process.env.NODE_ENV === "production" && !isCaptchaConfigured()) {
    return NextResponse.json(
      {
        error: "Captcha is not configured on this deployment.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(issueContactCaptchaChallenge(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
