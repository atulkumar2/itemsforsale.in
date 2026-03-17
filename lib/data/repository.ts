import "server-only";

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
import type {
  ItemFilters,
  SaveContactSubmissionInput,
  SaveItemInput,
  SaveLeadInput,
} from "@/lib/types";

export async function listPublicItems(filters: ItemFilters) {
  return listItems(filters);
}

export async function getPublicItemBySlug(slug: string) {
  return getItemBySlug(slug);
}

export async function submitLead(input: SaveLeadInput) {
  return createLead(input);
}

export async function listAdminItems() {
  return listItems();
}

export async function getAdminItemById(id: string) {
  return getItemById(id);
}

export async function saveAdminItem(input: SaveItemInput, files: File[]) {
  return saveItem(input, files);
}

export async function deleteAdminItem(itemId: string) {
  return deleteItem(itemId);
}

export async function listAdminLeads() {
  return listLeads();
}

export async function getAvailableCategories() {
  return listCategories();
}

export async function submitContactSubmission(input: SaveContactSubmissionInput) {
  return createContactSubmission(input);
}

export async function listAdminContactSubmissions() {
  return listContactSubmissions();
}