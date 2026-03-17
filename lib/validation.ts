import { z } from "zod";

import { itemStatuses } from "@/lib/constants";

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
  buyerName: z.string().trim().min(2, "Name is required."),
  phone: z.string().trim().max(40, "Phone is too long.").optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("")),
  message: z.string().trim().max(1000, "Message is too long.").optional().or(z.literal("")),
  bidPrice: optionalNumberField.optional().or(z.literal("")),
});

export type InterestFormValues = z.infer<typeof interestFormSchema>;

export const adminLoginSchema = z.object({
  email: z.string().trim().email("Enter the admin email."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export type AdminLoginValues = z.infer<typeof adminLoginSchema>;

export const itemFormSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(3, "Title is required."),
  description: z.string().trim().max(5000, "Description is too long.").optional().or(z.literal("")),
  category: z.string().trim().max(80, "Category is too long.").optional().or(z.literal("")),
  condition: z.string().trim().max(80, "Condition is too long.").optional().or(z.literal("")),
  purchaseDate: optionalDateField.optional().or(z.literal("")),
  purchasePrice: optionalNumberField.optional().or(z.literal("")),
  expectedPrice: optionalNumberField.optional().or(z.literal("")),
  availableFrom: optionalDateField.optional().or(z.literal("")),
  locationArea: z.string().trim().max(120, "Location is too long.").optional().or(z.literal("")),
  status: z.enum(itemStatuses),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;