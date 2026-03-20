import { z } from "zod";

import {
  contactFormLimits,
  emailRegex,
  interestFormLimits,
  itemFormLimits,
  itemStatuses,
  phoneRegex,
} from "@/lib/constants";

const optionalNumberField = z
  .string()
  .trim()
  .refine((value) => value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0), {
    message: "Enter a valid non-negative number.",
  });

const optionalDateField = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Use YYYY-MM-DD format.",
  });

export const interestFormSchema = z.object({
  itemId: z.string().uuid("Item reference is invalid."),
  buyerName: z
    .string()
    .trim()
    .min(2, "Name is required.")
    .max(interestFormLimits.buyerNameMax, "Name is too long."),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, "Phone must be exactly 10 digits and start with 6, 7, 8, or 9."),
  email: z
    .string()
    .trim()
    .max(interestFormLimits.emailMax, "Email is too long.")
    .regex(emailRegex, "Enter a valid email address.")
    .optional()
    .or(z.literal("")),
  location: z
    .string()
    .trim()
    .max(contactFormLimits.locationMax, "Location is too long.")
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters.")
    .max(interestFormLimits.messageMax, "Message is too long."),
  bidPrice: z
    .string()
    .trim()
    .max(interestFormLimits.bidPriceMax, "Bid price is too long.")
    .refine((value) => value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0), {
      message: "Enter a valid non-negative number.",
    })
    .optional()
    .or(z.literal("")),
  captchaToken: z
    .string()
    .trim()
    .min(1, "Captcha token is required."),
  captchaAnswer: z
    .string()
    .trim()
    .min(1, "Choose the correct answer.")
    .max(contactFormLimits.captchaAnswerMax, "Captcha answer is too long."),
});

export type InterestFormValues = z.infer<typeof interestFormSchema>;

export const bulkInterestFormSchema = z.object({
  itemIds: z
    .array(z.string().uuid("Item reference is invalid."))
    .min(1, "Select at least one item."),
  buyerName: z
    .string()
    .trim()
    .min(2, "Name is required.")
    .max(interestFormLimits.buyerNameMax, "Name is too long."),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, "Phone must be exactly 10 digits and start with 6, 7, 8, or 9."),
  email: z
    .string()
    .trim()
    .max(interestFormLimits.emailMax, "Email is too long.")
    .regex(emailRegex, "Enter a valid email address.")
    .optional()
    .or(z.literal("")),
  location: z
    .string()
    .trim()
    .max(contactFormLimits.locationMax, "Location is too long.")
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters.")
    .max(interestFormLimits.messageMax, "Message is too long."),
  captchaToken: z
    .string()
    .trim()
    .min(1, "Captcha token is required."),
  captchaAnswer: z
    .string()
    .trim()
    .min(1, "Choose the correct answer.")
    .max(contactFormLimits.captchaAnswerMax, "Captcha answer is too long."),
});

export type BulkInterestFormValues = z.infer<typeof bulkInterestFormSchema>;

export const adminLoginSchema = z.object({
  email: z.string().trim().email("Enter the admin email."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  captchaToken: z
    .string()
    .trim()
    .min(1, "Captcha token is required."),
  captchaAnswer: z
    .string()
    .trim()
    .min(1, "Choose the correct answer.")
    .max(contactFormLimits.captchaAnswerMax, "Captcha answer is too long."),
});

export type AdminLoginValues = z.infer<typeof adminLoginSchema>;

export const itemFormSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  title: z
    .string()
    .trim()
    .min(itemFormLimits.titleMin, "Title is required.")
    .max(itemFormLimits.titleMax, "Title is too long."),
  description: z
    .string()
    .trim()
    .max(itemFormLimits.descriptionMax, "Description is too long.")
    .optional()
    .or(z.literal("")),
  category: z
    .string()
    .trim()
    .max(itemFormLimits.categoryMax, "Category is too long.")
    .optional()
    .or(z.literal("")),
  condition: z
    .string()
    .trim()
    .max(itemFormLimits.conditionMax, "Condition is too long.")
    .optional()
    .or(z.literal("")),
  purchaseDate: optionalDateField.optional().or(z.literal("")),
  purchasePrice: optionalNumberField.max(itemFormLimits.bidPriceMax, "Purchase price is too long.").optional().or(z.literal("")),
  expectedPrice: optionalNumberField.max(itemFormLimits.bidPriceMax, "Expected price is too long.").optional().or(z.literal("")),
  availableFrom: optionalDateField.optional().or(z.literal("")),
  locationArea: z
    .string()
    .trim()
    .max(itemFormLimits.locationAreaMax, "Location is too long.")
    .optional()
    .or(z.literal("")),
  status: z.enum(itemStatuses),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

export const contactSellerSchema = z.object({
  buyerName: z
    .string()
    .trim()
    .min(2, "Name is required.")
    .max(contactFormLimits.buyerNameMax, "Name is too long."),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, "Phone must be exactly 10 digits and start with 6, 7, 8, or 9."),
  email: z
    .string()
    .trim()
    .max(contactFormLimits.emailMax, "Email is too long.")
    .regex(emailRegex, "Enter a valid email address.")
    .optional()
    .or(z.literal("")),
  location: z
    .string()
    .trim()
    .max(contactFormLimits.locationMax, "Location is too long.")
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters.")
    .max(contactFormLimits.messageMax, "Message is too long."),
  captchaToken: z
    .string()
    .trim()
    .min(1, "Captcha token is required."),
  captchaAnswer: z
    .string()
    .trim()
    .min(1, "Choose the correct answer.")
    .max(contactFormLimits.captchaAnswerMax, "Captcha answer is too long."),
});

export type ContactSellerValues = z.infer<typeof contactSellerSchema>;
