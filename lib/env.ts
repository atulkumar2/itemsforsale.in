export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getSiteName() {
  return process.env.NEXT_PUBLIC_SITE_NAME ?? "itemsforsale.in";
}

export function getDataMode() {
  return process.env.DATA_MODE ?? "local";
}

export function getAdminEmail() {
  return process.env.ADMIN_EMAIL ?? "admin@example.com";
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? "admin12345";
}

export function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? "local-dev-session-secret";
}