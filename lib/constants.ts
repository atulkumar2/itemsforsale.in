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