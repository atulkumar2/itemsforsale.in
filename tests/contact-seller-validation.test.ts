import { describe, expect, it } from "vitest";

import { contactFormLimits } from "@/lib/constants";
import { contactCaptchaChallenges } from "@/lib/contact-captcha";
import { contactSellerSchema } from "@/lib/validation";

function validPayload() {
  return {
    buyerName: "Atul Kumar",
    phone: "9876543210",
    email: "itemsforsale@outlook.in",
    location: "Bommanahalli",
    message: "I am interested in your dining set. Please share available timing.",
    captchaId: contactCaptchaChallenges[0]?.id ?? "math-7-plus-5",
    captchaAnswer: "12",
  };
}

describe("contact seller validation", () => {
  it("accepts a valid payload", () => {
    const result = contactSellerSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("rejects phone numbers that do not match 10-digit mobile pattern", () => {
    const badShort = contactSellerSchema.safeParse({ ...validPayload(), phone: "987654321" });
    const badStart = contactSellerSchema.safeParse({ ...validPayload(), phone: "5876543210" });

    expect(badShort.success).toBe(false);
    expect(badStart.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = contactSellerSchema.safeParse({
      ...validPayload(),
      email: "invalid-email",
    });

    expect(result.success).toBe(false);
  });

  it("rejects over-limit message size", () => {
    const longMessage = "a".repeat(contactFormLimits.messageMax + 1);
    const result = contactSellerSchema.safeParse({
      ...validPayload(),
      message: longMessage,
    });

    expect(result.success).toBe(false);
  });
});
