import { randomInt, randomUUID } from "node:crypto";

import {
  normalizeCaptchaAnswer,
  type ContactCaptchaChallenge,
  type ContactCaptchaQuestion,
} from "@/lib/contact-captcha";
import { contactCaptchaQuestions } from "@/lib/contact-captcha-questions";
import { signJsonToken, verifyJsonToken } from "@/lib/crypto-tokens";
import { getCaptchaSecret } from "@/lib/env";

type ContactCaptchaTokenPayload = {
  challengeId: string;
  issuedAt: number;
  nonce: string;
};

const captchaLifetimeMs = 30 * 60 * 1000;
const numericDistractorOffsets = [-9, -7, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 7, 9];

function shuffleValues(values: string[]) {
  const next = [...values];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!];
  }

  return next;
}

function uniqueNormalized(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeCaptchaAnswer(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(value);
  }

  return result;
}

function buildNumericOptions(question: ContactCaptchaQuestion) {
  const answer = Number.parseInt(question.correctAnswer, 10);
  if (Number.isNaN(answer)) {
    return [question.correctAnswer];
  }

  const distractors: string[] = [];

  for (const offset of shuffleValues(numericDistractorOffsets.map((value) => value.toString())).map(Number)) {
    const candidate = answer + offset;
    if (candidate < 0 || candidate === answer) {
      continue;
    }

    distractors.push(candidate.toString());
    if (distractors.length === 3) {
      break;
    }
  }

  return shuffleValues([question.correctAnswer, ...distractors]);
}

function buildTextOptions(question: ContactCaptchaQuestion) {
  const wrongAnswers = uniqueNormalized(question.wrongAnswers ?? []);
  const distractors = shuffleValues(wrongAnswers).slice(0, 3);
  return shuffleValues([question.correctAnswer, ...distractors]);
}

function buildOptions(question: ContactCaptchaQuestion) {
  const numericAnswer = Number.parseInt(question.correctAnswer, 10);
  const options = Number.isNaN(numericAnswer)
    ? buildTextOptions(question)
    : buildNumericOptions(question);

  return uniqueNormalized(options).slice(0, 4);
}

function getQuestionById(challengeId: string) {
  return contactCaptchaQuestions.find((entry) => entry.id === challengeId) ?? null;
}

export function issueContactCaptchaChallenge(): ContactCaptchaChallenge {
  const question = contactCaptchaQuestions[randomInt(contactCaptchaQuestions.length)];
  const token = signJsonToken(
    {
      challengeId: question.id,
      nonce: randomUUID(),
      issuedAt: Date.now(),
    } satisfies ContactCaptchaTokenPayload,
    getCaptchaSecret(),
  );

  return {
    options: buildOptions(question),
    prompt: question.prompt,
    token,
  };
}

export function verifyContactCaptchaChallenge(token: string, answer: string) {
  const payload = verifyJsonToken<ContactCaptchaTokenPayload>(token, getCaptchaSecret());

  if (!payload || Date.now() - payload.issuedAt > captchaLifetimeMs) {
    return null;
  }

  const question = getQuestionById(payload.challengeId);
  if (!question) {
    return null;
  }

  if (normalizeCaptchaAnswer(answer) !== normalizeCaptchaAnswer(question.correctAnswer)) {
    return null;
  }

  return {
    prompt: question.prompt,
  };
}
