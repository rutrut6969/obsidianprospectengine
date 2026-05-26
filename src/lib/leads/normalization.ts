export function normalizeText(value: string | null | undefined): string | null {
  const normalized = value
    ?.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  return normalized || null;
}

export function normalizePhone(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (!digits) return null;
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export function normalizeWebsite(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  try {
    const raw = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path === "/" ? "" : path}`;
  } catch {
    return normalizeText(value);
  }
}

export function buildDuplicateFingerprint(params: {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}): string | null {
  const name = normalizeText(params.name);
  const address = normalizeText(params.address);
  const city = normalizeText(params.city);
  const state = normalizeText(params.state);
  const parts = [name, address, city, state].filter(Boolean);
  return parts.length >= 2 ? parts.join("|") : null;
}
