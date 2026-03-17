import { contactCaptchaQuestions } from "@/lib/contact-captcha-questions";

export type ContactCaptchaChallenge = {
  id: string;
  prompt: string;
  answers: string[];
};

export const contactCaptchaChallenges: ContactCaptchaChallenge[] = contactCaptchaQuestions;

export function normalizeCaptchaAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isValidCaptchaAnswer(challengeId: string, answer: string) {
  const challenge = contactCaptchaChallenges.find((entry) => entry.id === challengeId);

  if (!challenge) {
    return false;
  }

  const actual = normalizeCaptchaAnswer(answer);
  const expectedAnswers = challenge.answers.map(normalizeCaptchaAnswer);

  return expectedAnswers.includes(actual);
}
