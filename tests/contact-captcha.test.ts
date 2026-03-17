import { describe, expect, it } from "vitest";

import {
  isValidCaptchaAnswer,
  normalizeCaptchaAnswer,
} from "@/lib/contact-captcha";

describe("contact captcha", () => {
  it("normalizes extra spaces and casing", () => {
    expect(normalizeCaptchaAnswer("  New   DELHI  ")).toBe("new delhi");
  });

  it("accepts known correct answers", () => {
    expect(isValidCaptchaAnswer("india-capital", "New Delhi")).toBe(true);
    expect(isValidCaptchaAnswer("bengaluru-state", "Karnataka")).toBe(true);
  });

  it("rejects incorrect answers or invalid question id", () => {
    expect(isValidCaptchaAnswer("india-capital", "Mumbai")).toBe(false);
    expect(isValidCaptchaAnswer("missing-question", "anything")).toBe(false);
  });
});
