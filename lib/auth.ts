import "server-only";

import { createHash } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  getAdminEmail,
  getAdminPassword,
  getAdminSessionSecret,
} from "@/lib/env";

const adminCookieName = "itemsforsale-admin-session";

function buildSessionToken() {
  return createHash("sha256")
    .update(`${getAdminEmail().toLowerCase()}:${getAdminPassword()}:${getAdminSessionSecret()}`)
    .digest("hex");
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return cookieStore.get(adminCookieName)?.value === buildSessionToken();
}

export async function signInAdmin(email: string, password: string) {
  if (email.toLowerCase() !== getAdminEmail().toLowerCase()) {
    return false;
  }

  if (password !== getAdminPassword()) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(adminCookieName, buildSessionToken(), {
    httpOnly: true,
    maxAge: 60 * 60 * 8,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return true;
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(adminCookieName);
}

export async function requireAdminPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

export async function ensureAdminApiAuth() {
  return isAdminAuthenticated();
}