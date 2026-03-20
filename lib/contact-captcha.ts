export type ContactCaptchaChallenge = {
  options: string[];
  prompt: string;
  token: string;
};

export type ContactCaptchaQuestion = {
  correctAnswer: string;
  id: string;
  prompt: string;
  wrongAnswers?: string[];
};

export function normalizeCaptchaAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
