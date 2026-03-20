import { NextResponse } from "next/server";

import { issueContactCaptchaChallenge } from "@/lib/contact-captcha-store";
import { isCaptchaConfigured } from "@/lib/env";

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
