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

export const contactFormLimits = {
  buyerNameMax: 80,
  phoneLength: 10,
  emailMax: 160,
  locationMax: 100,
  messageMax: 1200,
  captchaAnswerMax: 80,
} as const;

export const phoneRegex = /^[6-9]\d{9}$/;

export const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;