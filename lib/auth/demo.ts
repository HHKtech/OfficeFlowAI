import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export const DEMO_SESSION_COOKIE = "officeflow_demo_admin";
const DEMO_SESSION_TTL_SECONDS = 60 * 60 * 8;

const demoAccounts = {
  "it.admin@gmail.com": "DEMO_IT_ADMIN_PASSWORD",
  "facilities.admin@gmail.com": "DEMO_FACILITIES_ADMIN_PASSWORD",
  "security.admin@gmail.com": "DEMO_SECURITY_ADMIN_PASSWORD",
} as const;

function getCookieSecret() {
  return process.env.NEON_AUTH_COOKIE_SECRET ?? "";
}

function getPasswordHash(email: keyof typeof demoAccounts, password: string) {
  return scryptSync(password, `officeflow-demo:${email}:${getCookieSecret()}`, 32);
}

export function isDemoAdminEmail(email: string) {
  return email.trim().toLowerCase() in demoAccounts;
}

export function verifyDemoAdminCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase() as keyof typeof demoAccounts;
  const configuredPassword = demoAccounts[normalizedEmail]
    ? process.env[demoAccounts[normalizedEmail]]
    : undefined;
  if (!configuredPassword || !getCookieSecret()) return false;

  const candidate = getPasswordHash(normalizedEmail, password);
  const expected = getPasswordHash(normalizedEmail, configuredPassword);
  return timingSafeEqual(candidate, expected);
}

export function createDemoSession(email: string) {
  const payload = Buffer.from(JSON.stringify({
    email: email.trim().toLowerCase(),
    expiresAt: Date.now() + DEMO_SESSION_TTL_SECONDS * 1000,
  })).toString("base64url");
  const signature = createHmac("sha256", getCookieSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function getDemoSessionEmail(value: string | undefined) {
  if (!value || !getCookieSecret()) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = createHmac("sha256", getCookieSecret()).update(payload).digest("base64url");
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: string;
      expiresAt?: number;
    };
    if (!parsed.email || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) return null;
    return isDemoAdminEmail(parsed.email) ? parsed.email.toLowerCase() : null;
  } catch {
    return null;
  }
}