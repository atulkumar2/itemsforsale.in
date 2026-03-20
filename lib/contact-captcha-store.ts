import { randomInt, randomUUID } from "node:crypto";

import { getCaptchaSecret } from "@/lib/env";
import {
  normalizeCaptchaAnswer,
  type ContactCaptchaChallenge,
} from "@/lib/contact-captcha";
import { signJsonToken, verifyJsonToken } from "@/lib/crypto-tokens";

type StoredContactCaptchaChallenge = {
  id: string;
  prompt: string;
  answers: string[];
};

type ContactCaptchaTokenPayload = {
  challengeId: string;
  nonce: string;
  issuedAt: number;
};

const captchaLifetimeMs = 30 * 60 * 1000;

const contactCaptchaQuestions: StoredContactCaptchaChallenge[] = [
  { id: "math-7-plus-5", prompt: "What is 7 + 5?", answers: ["12", "twelve"] },
  { id: "math-9-minus-3", prompt: "What is 9 - 3?", answers: ["6", "six"] },
  { id: "math-8-plus-6", prompt: "What is 8 + 6?", answers: ["14", "fourteen"] },
  { id: "math-10-minus-4", prompt: "What is 10 - 4?", answers: ["6", "six"] },
  { id: "math-11-plus-2", prompt: "What is 11 + 2?", answers: ["13", "thirteen"] },
  { id: "math-15-minus-7", prompt: "What is 15 - 7?", answers: ["8", "eight"] },
  {
    id: "math-6-times-4",
    prompt: "What is 6 x 4?",
    answers: ["24", "twenty four", "twenty-four"],
  },
  {
    id: "math-3-times-5",
    prompt: "What is 3 x 5?",
    answers: ["15", "fifteen"],
  },
  {
    id: "math-9-plus-8",
    prompt: "What is 9 + 8?",
    answers: ["17", "seventeen"],
  },
  {
    id: "math-18-minus-9",
    prompt: "What is 18 - 9?",
    answers: ["9", "nine"],
  },
  {
    id: "math-7-times-3",
    prompt: "What is 7 x 3?",
    answers: ["21", "twenty one", "twenty-one"],
  },
  {
    id: "india-capital",
    prompt: "What is the capital city of India?",
    answers: ["new delhi", "delhi"],
  },
  {
    id: "india-country-code",
    prompt: "What country does the city of Mumbai belong to?",
    answers: ["india"],
  },
  {
    id: "india-national-language-common",
    prompt: "Which language is widely spoken in India and often used as a common official language?",
    answers: ["hindi"],
  },
  {
    id: "bengaluru-state",
    prompt: "Which state is Bengaluru in?",
    answers: ["karnataka"],
  },
  {
    id: "karnataka-country",
    prompt: "Which country is Karnataka in?",
    answers: ["india"],
  },
  {
    id: "bengaluru-capital-of",
    prompt: "Bengaluru is commonly known as the capital of which state?",
    answers: ["karnataka"],
  },
  {
    id: "bengaluru-country",
    prompt: "Name the country where Bengaluru is located.",
    answers: ["india"],
  },
  {
    id: "mysuru-state",
    prompt: "Which state is Mysuru in?",
    answers: ["karnataka"],
  },
  {
    id: "mangaluru-state",
    prompt: "Which state is Mangaluru in?",
    answers: ["karnataka"],
  },
  {
    id: "chennai-state",
    prompt: "Which state is Chennai in?",
    answers: ["tamilnadu"],
  },
  {
    id: "hyderabad-state",
    prompt: "Which state is Hyderabad in?",
    answers: ["telangana"],
  },
  {
    id: "kerala-country",
    prompt: "Which country is Kerala in?",
    answers: ["india"],
  },
  {
    id: "tamil-nadu-country",
    prompt: "Which country is Tamil Nadu in?",
    answers: ["india"],
  },
  {
    id: "goa-country",
    prompt: "Which country is Goa in?",
    answers: ["india"],
  },
  {
    id: "maharashtra-country",
    prompt: "Which country is Maharashtra in?",
    answers: ["india"],
  },
];

export function issueContactCaptchaChallenge(): ContactCaptchaChallenge {
  const challenge = contactCaptchaQuestions[randomInt(contactCaptchaQuestions.length)];
  const token = signJsonToken(
    {
      challengeId: challenge.id,
      nonce: randomUUID(),
      issuedAt: Date.now(),
    } satisfies ContactCaptchaTokenPayload,
    getCaptchaSecret(),
  );

  return {
    prompt: challenge.prompt,
    token,
  };
}

export function verifyContactCaptchaChallenge(token: string, answer: string) {
  const payload = verifyJsonToken<ContactCaptchaTokenPayload>(token, getCaptchaSecret());

  if (!payload || Date.now() - payload.issuedAt > captchaLifetimeMs) {
    return null;
  }

  const challenge = contactCaptchaQuestions.find((entry) => entry.id === payload.challengeId);
  if (!challenge) {
    return null;
  }

  const actual = normalizeCaptchaAnswer(answer);
  const expectedAnswers = challenge.answers.map(normalizeCaptchaAnswer);

  if (!expectedAnswers.includes(actual)) {
    return null;
  }

  return {
    prompt: challenge.prompt,
  };
}
