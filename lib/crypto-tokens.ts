import { createHmac, timingSafeEqual } from "node:crypto";

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function signJsonToken(payload: Record<string, unknown>, secret: string) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyJsonToken<T>(token: string, secret: string) {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = createHmac("sha256", secret).update(encodedPayload).digest();
  const actual = Buffer.from(signature, "base64url");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(encodedPayload)) as T;
  } catch {
    return null;
  }
}
