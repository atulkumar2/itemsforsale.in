import type { ItemStatus } from "@/lib/types";

function padDatePart(value: number) {
  return value.toString().padStart(2, "0");
}

export function toDateOnlyString(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const directMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/);
    if (directMatch) {
      return directMatch[0];
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    // When parsing a string like "2024-02-15", JavaScript interprets it in local timezone
    // To fix this, we need to parse it as UTC by using the ISO format with Z suffix
    const utcDate = new Date(trimmed + "T00:00:00Z");
    return `${utcDate.getUTCFullYear()}-${padDatePart(utcDate.getUTCMonth() + 1)}-${padDatePart(utcDate.getUTCDate())}`;
  }

  // For Date objects, use UTC components to avoid timezone offset issues
  return `${value.getUTCFullYear()}-${padDatePart(value.getUTCMonth() + 1)}-${padDatePart(value.getUTCDate())}`;
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Not listed";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | Date | null | undefined) {
  const dateOnly = toDateOnlyString(value);
  if (!dateOnly) {
    return "Not listed";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateOnly}T00:00:00.000Z`));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not listed";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

export function parseItemStatus(value?: string): ItemStatus | undefined {
  if (value === "available" || value === "reserved" || value === "sold") {
    return value;
  }

  return undefined;
}

export function normaliseOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseOptionalNumber(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseOptionalDate(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function getFileExtension(fileName: string) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.at(-1)?.toLowerCase() ?? "bin" : "bin";
}
