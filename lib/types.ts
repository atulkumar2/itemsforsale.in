export type ItemStatus = "available" | "reserved" | "sold";

export type Item = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  condition: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  expectedPrice: number | null;
  availableFrom: string | null;
  locationArea: string | null;
  status: ItemStatus;
  createdAt: string;
  updatedAt: string;
};

export type ItemImage = {
  id: string;
  itemId: string;
  imageUrl: string;
  sortOrder: number;
  createdAt: string;
};

export type Lead = {
  id: string;
  itemId: string;
  buyerName: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  bidPrice: number | null;
  createdAt: string;
};

export type ItemWithImages = Item & {
  images: ItemImage[];
};

export type LeadWithItem = Lead & {
  itemTitle: string;
  itemSlug: string;
};

export type ContactSubmission = {
  id: string;
  buyerName: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  message: string;
  captchaPrompt: string;
  createdAt: string;
};

export type LocalDatabase = {
  items: Item[];
  itemImages: ItemImage[];
  leads: Lead[];
  contactSubmissions: ContactSubmission[];
};

export type ItemFilters = {
  category?: string;
  query?: string;
  status?: ItemStatus;
};

export type LeadFilters = {
  itemId?: string;
  query?: string;
};

export type SaveItemInput = {
  id?: string;
  title: string;
  description?: string;
  category?: string;
  condition?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  expectedPrice?: number;
  availableFrom?: string;
  locationArea?: string;
  status: ItemStatus;
};

export type SaveLeadInput = {
  itemId: string;
  buyerName: string;
  phone?: string;
  email?: string;
  message?: string;
  bidPrice?: number;
};

export type SaveContactSubmissionInput = {
  buyerName: string;
  phone?: string;
  email?: string;
  location: string;
  message: string;
  captchaPrompt: string;
};