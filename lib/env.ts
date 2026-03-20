export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getSiteName() {
  return process.env.NEXT_PUBLIC_SITE_NAME ?? "itemsforsale.in";
}

export function getDataMode() {
  return process.env.DATA_MODE ?? "local";
}

export function getDatabaseUrl() {
  return process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/itemsforsale";
}

function readConfiguredEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function isAdminAuthConfigured() {
  return Boolean(
    readConfiguredEnv("ADMIN_EMAIL")
    && readConfiguredEnv("ADMIN_PASSWORD")
    && readConfiguredEnv("ADMIN_SESSION_SECRET"),
  );
}

export function isCaptchaConfigured() {
  return Boolean(
    readConfiguredEnv("CONTACT_CAPTCHA_SECRET")
    || readConfiguredEnv("ADMIN_SESSION_SECRET")
    || !isProduction(),
  );
}

export function getAdminEmail() {
  return readConfiguredEnv("ADMIN_EMAIL")
    ?? (isProduction() ? "" : "admin@example.com");
}

export function getAdminPassword() {
  return readConfiguredEnv("ADMIN_PASSWORD")
    ?? (isProduction() ? "" : "admin12345");
}

export function getAdminSessionSecret() {
  return readConfiguredEnv("ADMIN_SESSION_SECRET")
    ?? (isProduction() ? "" : "local-dev-session-secret");
}

export function getCaptchaSecret() {
  return readConfiguredEnv("CONTACT_CAPTCHA_SECRET")
    ?? getAdminSessionSecret();
}
