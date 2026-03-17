import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { localSeedDatabase } from "@/lib/data/local-seed";
import type {
  ContactSubmission,
  Item,
  ItemFilters,
  ItemImage,
  ItemWithImages,
  Lead,
  LeadWithItem,
  LocalDatabase,
  SaveContactSubmissionInput,
  SaveItemInput,
  SaveLeadInput,
} from "@/lib/types";
import {
  getFileExtension,
  normaliseOptionalString,
  slugify,
} from "@/lib/utils";

const databaseFilePath = path.join(process.cwd(), "data", "local-db.json");
const uploadsRootPath = path.join(process.cwd(), "public", "uploads");

async function ensureLocalDatabase() {
  try {
    await readFile(databaseFilePath, "utf8");
  } catch {
    await mkdir(path.dirname(databaseFilePath), { recursive: true });
    await writeFile(databaseFilePath, JSON.stringify(localSeedDatabase, null, 2));
  }
}

async function readDatabase(): Promise<LocalDatabase> {
  await ensureLocalDatabase();
  const raw = await readFile(databaseFilePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<LocalDatabase>;

  return {
    items: parsed.items ?? [],
    itemImages: parsed.itemImages ?? [],
    leads: parsed.leads ?? [],
    contactSubmissions: parsed.contactSubmissions ?? [],
  };
}

async function writeDatabase(database: LocalDatabase) {
  await writeFile(databaseFilePath, JSON.stringify(database, null, 2));
}

function hydrateItems(database: LocalDatabase): ItemWithImages[] {
  return database.items
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((item) => ({
      ...item,
      images: database.itemImages
        .filter((image) => image.itemId === item.id)
        .sort((left, right) => left.sortOrder - right.sortOrder),
    }));
}

function ensureUniqueSlug(title: string, items: Item[], currentItemId?: string) {
  const baseSlug = slugify(title) || "item";
  let candidate = baseSlug;
  let suffix = 2;

  while (
    items.some(
      (item) => item.slug === candidate && item.id !== currentItemId,
    )
  ) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function storeUploadedImages(itemId: string, files: File[]) {
  if (files.length === 0) {
    return [] as ItemImage[];
  }

  await mkdir(path.join(uploadsRootPath, itemId), { recursive: true });

  const uploadedImages = await Promise.all(
    files.map(async (file, index) => {
      const extension = getFileExtension(file.name);
      const fileName = `${Date.now()}-${index}.${extension}`;
      const relativePath = path.posix.join("/uploads", itemId, fileName);
      const outputPath = path.join(uploadsRootPath, itemId, fileName);
      const bytes = Buffer.from(await file.arrayBuffer());

      await writeFile(outputPath, bytes);

      return {
        id: crypto.randomUUID(),
        itemId,
        imageUrl: relativePath,
        sortOrder: index,
        createdAt: new Date().toISOString(),
      } satisfies ItemImage;
    }),
  );

  return uploadedImages;
}

export async function listItems(filters: ItemFilters = {}) {
  const database = await readDatabase();
  const items = hydrateItems(database);

  return items.filter((item) => {
    const matchesQuery = filters.query
      ? item.title.toLowerCase().includes(filters.query.toLowerCase())
      : true;
    const matchesStatus = filters.status ? item.status === filters.status : true;
    const matchesCategory = filters.category
      ? item.category?.toLowerCase() === filters.category.toLowerCase()
      : true;

    return matchesQuery && matchesStatus && matchesCategory;
  });
}

export async function getItemBySlug(slug: string) {
  const items = await listItems();
  return items.find((item) => item.slug === slug) ?? null;
}

export async function getItemById(id: string) {
  const items = await listItems();
  return items.find((item) => item.id === id) ?? null;
}

export async function listCategories() {
  const items = await listItems();
  return Array.from(
    new Set(
      items
        .map((item) => item.category)
        .filter((category): category is string => Boolean(category)),
    ),
  ).sort();
}

export async function createLead(input: SaveLeadInput) {
  const database = await readDatabase();
  const lead: Lead = {
    id: crypto.randomUUID(),
    itemId: input.itemId,
    buyerName: input.buyerName,
    phone: normaliseOptionalString(input.phone) ?? null,
    email: normaliseOptionalString(input.email) ?? null,
    message: normaliseOptionalString(input.message) ?? null,
    bidPrice: input.bidPrice ?? null,
    createdAt: new Date().toISOString(),
  };

  database.leads.unshift(lead);
  await writeDatabase(database);
  return lead;
}

export async function listLeads() {
  const database = await readDatabase();
  const itemsById = new Map(database.items.map((item) => [item.id, item]));

  return database.leads
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((lead) => {
      const item = itemsById.get(lead.itemId);

      return {
        ...lead,
        itemSlug: item?.slug ?? "",
        itemTitle: item?.title ?? "Deleted item",
      } satisfies LeadWithItem;
    });
}

export async function createContactSubmission(input: SaveContactSubmissionInput) {
  const database = await readDatabase();
  const submission: ContactSubmission = {
    id: crypto.randomUUID(),
    buyerName: input.buyerName,
    phone: normaliseOptionalString(input.phone) ?? null,
    email: normaliseOptionalString(input.email) ?? null,
    message: normaliseOptionalString(input.message) ?? "",
    captchaPrompt: input.captchaPrompt,
    createdAt: new Date().toISOString(),
  };

  database.contactSubmissions.unshift(submission);
  await writeDatabase(database);

  return submission;
}

export async function listContactSubmissions() {
  const database = await readDatabase();

  return database.contactSubmissions
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function saveItem(input: SaveItemInput, files: File[]) {
  const database = await readDatabase();
  const existingItem = input.id
    ? database.items.find((item) => item.id === input.id) ?? null
    : null;
  const itemId = existingItem?.id ?? crypto.randomUUID();
  const now = new Date().toISOString();

  const nextItem: Item = {
    id: itemId,
    slug: ensureUniqueSlug(input.title, database.items, existingItem?.id),
    title: input.title,
    description: normaliseOptionalString(input.description) ?? null,
    category: normaliseOptionalString(input.category) ?? null,
    condition: normaliseOptionalString(input.condition) ?? null,
    purchaseDate: normaliseOptionalString(input.purchaseDate) ?? null,
    purchasePrice: input.purchasePrice ?? null,
    expectedPrice: input.expectedPrice ?? null,
    availableFrom: normaliseOptionalString(input.availableFrom) ?? null,
    locationArea: normaliseOptionalString(input.locationArea) ?? null,
    status: input.status,
    createdAt: existingItem?.createdAt ?? now,
    updatedAt: now,
  };

  const uploadedImages = await storeUploadedImages(itemId, files);

  if (existingItem) {
    database.items = database.items.map((item) => (item.id === existingItem.id ? nextItem : item));
  } else {
    database.items.unshift(nextItem);
  }

  if (uploadedImages.length > 0) {
    const currentImages = database.itemImages.filter((image) => image.itemId === itemId);
    const offset = currentImages.length;
    database.itemImages = database.itemImages.concat(
      uploadedImages.map((image, index) => ({
        ...image,
        sortOrder: offset + index,
      })),
    );
  }

  await writeDatabase(database);
  return getItemById(itemId);
}

export async function deleteItem(itemId: string) {
  const database = await readDatabase();
  database.items = database.items.filter((item) => item.id !== itemId);
  database.itemImages = database.itemImages.filter((image) => image.itemId !== itemId);
  database.leads = database.leads.filter((lead) => lead.itemId !== itemId);
  await writeDatabase(database);
}