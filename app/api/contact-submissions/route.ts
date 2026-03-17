import { NextResponse } from "next/server";

import {
  contactCaptchaChallenges,
  isValidCaptchaAnswer,
} from "@/lib/contact-captcha";
import { submitContactSubmission } from "@/lib/data/repository";
import { contactSellerSchema } from "@/lib/validation";

export async function POST(request: Request) {
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

  if (!isValidCaptchaAnswer(parsed.data.captchaId, parsed.data.captchaAnswer)) {
    return NextResponse.json(
      {
        error: "Captcha answer is incorrect.",
      },
      { status: 400 },
    );
  }

  const challenge = contactCaptchaChallenges.find((entry) => entry.id === parsed.data.captchaId);

  await submitContactSubmission({
    buyerName: parsed.data.buyerName,
    phone: parsed.data.phone,
    email: parsed.data.email,
    message: parsed.data.message,
    captchaPrompt: challenge?.prompt ?? "Unknown prompt",
  });

  return NextResponse.json(
    {
      message: "Contact request submitted successfully.",
    },
    { status: 201 },
  );
}
