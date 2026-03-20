import { describe, expect, it } from "vitest";

import { interestFormLimits } from "@/lib/constants";
import { issueContactCaptchaChallenge } from "@/lib/contact-captcha-store";
import { bulkInterestFormSchema } from "@/lib/validation";

function validPayload() {
  const challenge = issueContactCaptchaChallenge();

  return {
    itemIds: [
      "064b9d22-f5d1-4fcb-9237-7b6ba8123401",
      "164b9d22-f5d1-4fcb-9237-7b6ba8123402",
    ],
    buyerName: "Atul Kumar",
    phone: "9876543210",
    email: "itemsforsale@outlook.in",
    location: "Bommanahalli",
    message: "I am interested in these items and would like to inspect them this week.",
    captchaToken: challenge.token,
    captchaAnswer: "12",
  };
}

describe("bulk interest form validation", () => {
  it("accepts a valid payload", () => {
    expect(bulkInterestFormSchema.safeParse(validPayload()).success).toBe(true);
  });

  it("accepts an empty location", () => {
    const result = bulkInterestFormSchema.safeParse({
      ...validPayload(),
      location: "",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty item selection", () => {
    const result = bulkInterestFormSchema.safeParse({
      ...validPayload(),
      itemIds: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects too-short and too-long messages", () => {
    const shortMessage = bulkInterestFormSchema.safeParse({
      ...validPayload(),
      message: "short",
    });
    const longMessage = bulkInterestFormSchema.safeParse({
      ...validPayload(),
      message: "a".repeat(interestFormLimits.messageMax + 1),
    });

    expect(shortMessage.success).toBe(false);
    expect(longMessage.success).toBe(false);
  });
});
