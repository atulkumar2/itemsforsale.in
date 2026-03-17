import "server-only";

import { getDataMode, getDatabaseUrl } from "@/lib/env";

import {
  createContactSubmission,
  createLead,
  deleteItem,
  getItemById,
  getItemBySlug,
  listCategories,
  listContactSubmissions,
  listItems,
  listLeads,
  saveItem,
} from "@/lib/data/local-store";
import {
  createContactSubmission as createContactSubmissionPostgres,
  createLead as createLeadPostgres,
  checkPostgresConnection,
  deleteItem as deleteItemPostgres,
  getItemById as getItemByIdPostgres,
  getItemBySlug as getItemBySlugPostgres,
  listCategories as listCategoriesPostgres,
  listContactSubmissions as listContactSubmissionsPostgres,
  listItems as listItemsPostgres,
  listLeads as listLeadsPostgres,
  saveItem as saveItemPostgres,
} from "@/lib/data/postgres-store";
import type {
  ItemFilters,
  LeadFilters,
  SaveContactSubmissionInput,
  SaveItemInput,
  SaveLeadInput,
} from "@/lib/types";

export async function listPublicItems(filters: ItemFilters) {
  return getDataMode() === "postgres" ? listItemsPostgres(filters) : listItems(filters);
}

export async function getPublicItemBySlug(slug: string) {
  return getDataMode() === "postgres" ? getItemBySlugPostgres(slug) : getItemBySlug(slug);
}

export async function submitLead(input: SaveLeadInput) {
  return getDataMode() === "postgres" ? createLeadPostgres(input) : createLead(input);
}

export async function listAdminItems() {
  return getDataMode() === "postgres" ? listItemsPostgres() : listItems();
}

export async function getAdminItemById(id: string) {
  return getDataMode() === "postgres" ? getItemByIdPostgres(id) : getItemById(id);
}

export async function saveAdminItem(input: SaveItemInput, files: File[]) {
  return getDataMode() === "postgres" ? saveItemPostgres(input, files) : saveItem(input, files);
}

export async function deleteAdminItem(itemId: string) {
  return getDataMode() === "postgres" ? deleteItemPostgres(itemId) : deleteItem(itemId);
}

export async function listAdminLeads(filters: LeadFilters = {}) {
  return getDataMode() === "postgres" ? listLeadsPostgres(filters) : listLeads(filters);
}

export async function getAvailableCategories() {
  return getDataMode() === "postgres" ? listCategoriesPostgres() : listCategories();
}

export async function submitContactSubmission(input: SaveContactSubmissionInput) {
  return getDataMode() === "postgres"
    ? createContactSubmissionPostgres(input)
    : createContactSubmission(input);
}

export async function listAdminContactSubmissions() {
  return getDataMode() === "postgres"
    ? listContactSubmissionsPostgres()
    : listContactSubmissions();
}

export async function getAdminSystemStatus() {
  const dataMode = getDataMode();
  const isPostgresMode = dataMode === "postgres";

  let databaseTarget: {
    host: string | null;
    port: string | null;
    database: string | null;
  } | null = null;

  if (isPostgresMode) {
    try {
      const databaseUrl = new URL(getDatabaseUrl());
      databaseTarget = {
        host: databaseUrl.hostname || null,
        port: databaseUrl.port || "5432",
        database: databaseUrl.pathname.replace(/^\//, "") || null,
      };
    } catch {
      databaseTarget = {
        host: null,
        port: null,
        database: null,
      };
    }
  }

  const postgres = isPostgresMode
    ? await checkPostgresConnection()
    : { reachable: null, error: null };

  return {
    dataMode,
    persistence: isPostgresMode ? "postgres" : "json",
    uploadsStorage: "filesystem",
    databaseTarget,
    postgres,
  };
}