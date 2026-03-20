import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  getAdminEmail,
  getAdminPassword,
  getAdminSessionSecret,
  isAdminAuthConfigured,
} from "@/lib/env";
import { signJsonToken, verifyJsonToken } from "@/lib/crypto-tokens";

const adminCookieName = "itemsforsale-admin-session";
const adminSessionLifetimeSeconds = 60 * 60 * 8;

type AdminSessionPayload = {
  email: string;
  sessionId: string;
  expiresAt: number;
};

function buildSessionToken() {
  return signJsonToken(
    {
      email: getAdminEmail().toLowerCase(),
      sessionId: randomUUID(),
      expiresAt: Date.now() + adminSessionLifetimeSeconds * 1000,
    } satisfies AdminSessionPayload,
    getAdminSessionSecret(),
  );
}

function readSessionToken(token?: string) {
  if (!token || (process.env.NODE_ENV === "production" && !isAdminAuthConfigured())) {
    return null;
  }

  const payload = verifyJsonToken<AdminSessionPayload>(token, getAdminSessionSecret());
  if (!payload) {
    return null;
  }

  if (payload.expiresAt <= Date.now()) {
    return null;
  }

  if (payload.email !== getAdminEmail().toLowerCase()) {
    return null;
  }

  return payload;
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return Boolean(readSessionToken(cookieStore.get(adminCookieName)?.value));
}

export async function signInAdmin(email: string, password: string) {
  if (!isAdminAuthConfigured() && process.env.NODE_ENV === "production") {
    return false;
  }

  if (email.toLowerCase() !== getAdminEmail().toLowerCase()) {
    return false;
  }

  if (password !== getAdminPassword()) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(adminCookieName, buildSessionToken(), {
    httpOnly: true,
    maxAge: adminSessionLifetimeSeconds,
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
