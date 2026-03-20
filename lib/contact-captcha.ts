export type ContactCaptchaChallenge = {
  prompt: string;
  token: string;
};

export function normalizeCaptchaAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
