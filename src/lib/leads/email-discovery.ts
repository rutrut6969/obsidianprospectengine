import { prisma } from "@/lib/prisma";

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const FAKE_EMAIL_PATTERNS = [
  "example.com",
  "example.org",
  "test.com",
  "domain.com",
  "email.com",
  "yourcompany",
  "yourdomain",
  "sentry.io",
  "wixpress.com",
];

function normalizeWebsiteUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function isRealEmail(email: string): boolean {
  const lower = email.toLowerCase();
  if (FAKE_EMAIL_PATTERNS.some((pattern) => lower.includes(pattern))) return false;
  if (lower.startsWith("noreply@") || lower.startsWith("no-reply@")) return false;
  return true;
}

function extractEmails(html: string): string[] {
  const mailto = [...html.matchAll(/mailto:([^"'>?\s]+)/gi)].map((match) =>
    decodeURIComponent(match[1])
  );
  const visible = html.match(EMAIL_REGEX) ?? [];
  return unique([...mailto, ...visible].map((email) => email.trim().toLowerCase()).filter(isRealEmail));
}

function confidenceFor(email: string, sourceUrl: string): number {
  const local = email.split("@")[0];
  let score = 60;
  if (["info", "hello", "contact", "sales", "office"].includes(local)) score += 15;
  if (sourceUrl.includes("/contact")) score += 15;
  if (sourceUrl.includes("/about")) score += 8;
  return Math.min(95, score);
}

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ObsidianProspectEngine/1.0 (+https://prospect.obsidian-systems.tech)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
      return null;
    }
    return response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function discoverLeadEmails(businessLeadId: string) {
  const lead = await prisma.businessLead.findUnique({ where: { id: businessLeadId } });
  if (!lead?.websiteUrl) {
    await prisma.businessLead.update({
      where: { id: businessLeadId },
      data: { emailDiscoveryStatus: "FAILED", emailConfidence: null },
    });
    return { emails: [], status: "FAILED" as const };
  }

  const root = normalizeWebsiteUrl(lead.websiteUrl);
  let base: URL;
  try {
    base = new URL(root);
  } catch {
    await prisma.businessLead.update({
      where: { id: businessLeadId },
      data: { emailDiscoveryStatus: "FAILED", emailConfidence: null },
    });
    return { emails: [], status: "FAILED" as const };
  }

  const pages = unique([
    base.toString(),
    new URL("/contact", base).toString(),
    new URL("/about", base).toString(),
    new URL("/services", base).toString(),
  ]);

  const found: Array<{ email: string; sourceUrl: string; confidence: number }> = [];
  for (const page of pages) {
    const html = await fetchPage(page);
    if (!html) continue;
    for (const email of extractEmails(html)) {
      found.push({ email, sourceUrl: page, confidence: confidenceFor(email, page) });
    }
  }

  const byEmail = new Map<string, { email: string; sourceUrl: string; confidence: number }>();
  for (const item of found) {
    const existing = byEmail.get(item.email);
    if (!existing || item.confidence > existing.confidence) byEmail.set(item.email, item);
  }

  const emails = [...byEmail.values()].sort((a, b) => b.confidence - a.confidence);
  const primary = emails[0] ?? null;

  await prisma.$transaction(async (tx) => {
    for (const item of emails) {
      await tx.contactMethod.upsert({
        where: {
          businessLeadId_type_value: {
            businessLeadId,
            type: "EMAIL",
            value: item.email,
          },
        },
        create: {
          businessLeadId,
          type: "EMAIL",
          value: item.email,
          confidence: item.confidence,
          sourceUrl: item.sourceUrl,
          isPrimary: item.email === primary?.email,
        },
        update: {
          confidence: item.confidence,
          sourceUrl: item.sourceUrl,
          isPrimary: item.email === primary?.email,
        },
      });
    }

    await tx.businessLead.update({
      where: { id: businessLeadId },
      data: {
        primaryEmail: primary?.email ?? null,
        emailConfidence: primary?.confidence ?? null,
        emailDiscoveryStatus: emails.length > 0 ? "FOUND" : "NOT_FOUND",
      },
    });
  });

  return { emails, status: emails.length > 0 ? ("FOUND" as const) : ("NOT_FOUND" as const) };
}
