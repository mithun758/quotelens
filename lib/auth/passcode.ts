import { createHmac, timingSafeEqual } from "node:crypto";

// Single shared gate to protect API credit. There are no user accounts.
// The cookie holds an HMAC derived from the passcode, never the passcode
// itself, so changing DEMO_PASSCODE invalidates every existing cookie.

export const PASSCODE_COOKIE = "ql_gate";
// A random id per browser, used only to rate-limit AI calls. The passcode cookie is the
// same for everyone, so it cannot tell sessions apart.
export const SESSION_COOKIE = "ql_sid";
export const PASSCODE_COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

function configuredPasscode(): string | null {
  const value = process.env.DEMO_PASSCODE;
  return value && value.length > 0 ? value : null;
}

export function isGateConfigured(): boolean {
  return configuredPasscode() !== null;
}

function tokenFor(passcode: string): string {
  return createHmac("sha256", passcode).update("quotelens-gate-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Fails closed: with no DEMO_PASSCODE set, nothing is accepted.
export function checkPasscode(attempt: string): boolean {
  const passcode = configuredPasscode();
  if (!passcode) return false;
  return safeEqual(tokenFor(attempt), tokenFor(passcode));
}

export function sessionToken(): string | null {
  const passcode = configuredPasscode();
  return passcode ? tokenFor(passcode) : null;
}

export function isValidSessionToken(token: string | undefined): boolean {
  const expected = sessionToken();
  if (!expected || !token) return false;
  return safeEqual(token, expected);
}
