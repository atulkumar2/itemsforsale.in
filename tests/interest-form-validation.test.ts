import { describe, expect, it } from "vitest";

import { interestFormLimits } from "@/lib/constants";
import { issueContactCaptchaChallenge } from "@/lib/contact-captcha-store";
import { interestFormSchema } from "@/lib/validation";

function validPayload() {
  const challenge = issueContactCaptchaChallenge();

  return {
    itemId: "064b9d22-f5d1-4fcb-9237-7b6ba8123401",
    buyerName: "Atul Kumar",
    phone: "9876543210",
    email: "itemsforsale@outlook.in",
    message: "I am interested in this item and would like to visit this week.",
    bidPrice: "12000",
    captchaToken: challenge.token,
    captchaAnswer: "12",
  };
}

describe("interest form validation", () => {
  it("accepts a valid payload", () => {
    expect(interestFormSchema.safeParse(validPayload()).success).toBe(true);
  });

  it("rejects invalid phone and email values", () => {
    const invalidPhone = interestFormSchema.safeParse({ ...validPayload(), phone: "1234567890" });
    const invalidEmail = interestFormSchema.safeParse({ ...validPayload(), email: "bad-email" });

    expect(invalidPhone.success).toBe(false);
    expect(invalidEmail.success).toBe(false);
  });

  it("rejects too-short or too-long message values", () => {
    const shortMessage = interestFormSchema.safeParse({ ...validPayload(), message: "short" });
    const longMessage = interestFormSchema.safeParse({
      ...validPayload(),
      message: "a".repeat(interestFormLimits.messageMax + 1),
    });

    expect(shortMessage.success).toBe(false);
    expect(longMessage.success).toBe(false);
  });
});
