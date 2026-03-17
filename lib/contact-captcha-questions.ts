import type { ContactCaptchaChallenge } from "@/lib/contact-captcha";

export const contactCaptchaQuestions: ContactCaptchaChallenge[] = [
  { id: "math-7-plus-5", prompt: "What is 7 + 5?", answers: ["12", "twelve"] },
  { id: "math-9-minus-3", prompt: "What is 9 - 3?", answers: ["6", "six"] },
  {
    id: "math-6-times-4",
    prompt: "What is 6 x 4?",
    answers: ["24", "twenty four", "twenty-four"],
  },
  {
    id: "india-capital",
    prompt: "What is the capital city of India?",
    answers: ["new delhi", "delhi"],
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
];
