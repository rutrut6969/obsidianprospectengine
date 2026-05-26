export const SUPER_ADMIN_EMAIL = "isaac.rutledgev@obsidian-systems.tech";

export const SESSION_COOKIE = "ope_session";

export const INVITE_EXPIRY_DAYS = 7;

/** Minimum SESSION_SECRET length enforced at runtime */
export const SESSION_SECRET_MIN_LENGTH = 32;

export function getAppUrl(): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
