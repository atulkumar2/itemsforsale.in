import type { NextConfig } from "next";

function toAllowedDevOrigin(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // Next.js accepts host patterns here, so normalize full URLs to hostnames.
  if (trimmed.includes("://")) {
    try {
      return new URL(trimmed).hostname;
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map(toAllowedDevOrigin)
  .filter((origin): origin is string => Boolean(origin));

const nextConfig: NextConfig = {
  allowedDevOrigins,
};

export default nextConfig;
