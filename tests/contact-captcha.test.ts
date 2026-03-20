import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeCaptchaAnswer } from "@/lib/contact-captcha";
import { contactCaptchaQuestions } from "@/lib/contact-captcha-questions";
import {
  issueContactCaptchaChallenge,
  verifyContactCaptchaChallenge,
} from "@/lib/contact-captcha-store";
import { signJsonToken } from "@/lib/crypto-tokens";

describe("contact captcha", () => {
  const originalSecret = process.env.CONTACT_CAPTCHA_SECRET;

  beforeEach(() => {
    process.env.CONTACT_CAPTCHA_SECRET = "test-captcha-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CONTACT_CAPTCHA_SECRET;
    } else {
      process.env.CONTACT_CAPTCHA_SECRET = originalSecret;
    }
    vi.useRealTimers();
  });

  it("normalizes extra spaces and casing", () => {
    expect(normalizeCaptchaAnswer("  New   DELHI  ")).toBe("new delhi");
  });

  it("issues a signed challenge token and accepts a correct answer", () => {
    const challenge = issueContactCaptchaChallenge();
    expect(challenge.prompt.length).toBeGreaterThan(0);
    expect(challenge.token.length).toBeGreaterThan(0);
    expect(challenge.options).toHaveLength(4);
    expect(new Set(challenge.options).size).toBe(4);

    const matchingQuestion = contactCaptchaQuestions.find((entry) => entry.prompt === challenge.prompt);
    expect(matchingQuestion).toBeTruthy();
    expect(challenge.options).toContain(matchingQuestion!.correctAnswer);
    expect(verifyContactCaptchaChallenge(challenge.token, matchingQuestion!.correctAnswer)).toEqual({
      prompt: challenge.prompt,
    });
  });

  it("rejects invalid or tampered tokens", () => {
    const challenge = issueContactCaptchaChallenge();

    expect(verifyContactCaptchaChallenge("invalid-token", "12")).toBeNull();
    expect(verifyContactCaptchaChallenge(`${challenge.token}tampered`, "12")).toBeNull();
  });

  it("rejects expired challenge tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T10:00:00.000Z"));

    const token = signJsonToken(
      {
        challengeId: "math-7-plus-5",
        nonce: "nonce-1",
        issuedAt: Date.now() - (30 * 60 * 1000 + 1),
      },
      "test-captcha-secret",
    );

    expect(verifyContactCaptchaChallenge(token, "12")).toBeNull();
  });

  it("rejects tokens signed with a different captcha secret", () => {
    const token = signJsonToken(
      {
        challengeId: "math-7-plus-5",
        nonce: "nonce-1",
        issuedAt: Date.now(),
      },
      "other-secret",
    );

    expect(verifyContactCaptchaChallenge(token, "12")).toBeNull();
  });
});
