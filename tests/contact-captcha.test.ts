import { describe, expect, it } from "vitest";

import { normalizeCaptchaAnswer } from "@/lib/contact-captcha";
import {
  issueContactCaptchaChallenge,
  verifyContactCaptchaChallenge,
} from "@/lib/contact-captcha-store";

describe("contact captcha", () => {
  it("normalizes extra spaces and casing", () => {
    expect(normalizeCaptchaAnswer("  New   DELHI  ")).toBe("new delhi");
  });

  it("issues a signed challenge token and accepts a correct answer", () => {
    const challenge = issueContactCaptchaChallenge();
    expect(challenge.prompt.length).toBeGreaterThan(0);
    expect(challenge.token.length).toBeGreaterThan(0);

    const knownAnswers = [
      "12",
      "twelve",
      "6",
      "six",
      "14",
      "fourteen",
      "13",
      "thirteen",
      "8",
      "eight",
      "24",
      "twenty four",
      "15",
      "fifteen",
      "17",
      "seventeen",
      "9",
      "nine",
      "21",
      "twenty one",
      "new delhi",
      "delhi",
      "india",
      "hindi",
      "karnataka",
      "tamilnadu",
      "telangana",
    ];
    const matchedAnswer = knownAnswers.find((answer) =>
      verifyContactCaptchaChallenge(challenge.token, answer),
    );

    expect(matchedAnswer).toBeTruthy();
  });

  it("rejects invalid or tampered tokens", () => {
    const challenge = issueContactCaptchaChallenge();

    expect(verifyContactCaptchaChallenge("invalid-token", "12")).toBeNull();
    expect(verifyContactCaptchaChallenge(`${challenge.token}tampered`, "12")).toBeNull();
  });
});
