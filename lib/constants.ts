import type { ItemStatus } from "@/lib/types";

export const itemStatuses: ItemStatus[] = ["available", "reserved", "sold"];

export const itemCategories = [
  "Living room",
  "Bedroom",
  "Dining",
  "Storage",
  "Appliances",
  "Electronics",
  "Decor",
  "Outdoor",
] as const;

export const itemFormLimits = {
  titleMin: 3,
  titleMax: 200,
  descriptionMax: 5000,
  categoryMax: 80,
  conditionMax: 80,
  locationAreaMax: 120,
  bidPriceMax: 14,
  slugMax: 220,
  imageUrlMax: 500,
  thumbnailUrlMax: 500,
} as const;

export const imageUploadLimits = {
  maxFiles: 8,
  maxFileSizeBytes: 5 * 1024 * 1024,
} as const;

export const contactFormLimits = {
  buyerNameMax: 80,
  phoneLength: 10,
  emailMax: 160,
  locationMax: 100,
  messageMax: 1200,
  captchaAnswerMax: 80,
} as const;

export const interestFormLimits = {
  buyerNameMax: 80,
  phoneLength: 10,
  emailMax: 160,
  messageMax: 1000,
  bidPriceMax: 9,
} as const;

export const phoneRegex = /^[6-9]\d{9}$/;

export const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
