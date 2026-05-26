import { WebsiteStatus } from "@prisma/client";
import {
  AuditSignals,
  calculateLeadScore,
  websiteStatusFromSignals,
} from "./lead-scoring";

const FACEBOOK_HOSTS = [
  "facebook.com",
  "fb.com",
  "m.facebook.com",
  "www.facebook.com",
];

const OUTDATED_KEYWORDS = [
  "under construction",
  "coming soon",
  "copyright 201",
  "copyright 200",
  "best viewed in internet explorer",
  "flash player",
  "table cellpadding",
];

export interface WebsiteAuditResult {
  signals: AuditSignals;
  websiteStatus: WebsiteStatus;
  leadScore: number;
  homepageTitle: string | null;
  metaDescription: string | null;
  responseStatus: number | null;
  loadTimeMs: number | null;
  notes: string | null;
}

function isFacebookUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return FACEBOOK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function extractMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

function looksOutdated(html: string, title: string | null): boolean {
  const haystack = `${html} ${title ?? ""}`.toLowerCase();
  return OUTDATED_KEYWORDS.some((kw) => haystack.includes(kw));
}

/** Fetches and classifies a business website (server-side only). */
export async function auditWebsite(
  websiteUrl: string | null | undefined
): Promise<WebsiteAuditResult> {
  if (!websiteUrl?.trim()) {
    const signals: AuditSignals = {
      hasWebsite: false,
      isBroken: false,
      isHttps: null,
      isFacebookOnly: false,
      isOutdated: false,
    };
    const websiteStatus = "NO_WEBSITE";
    return {
      signals,
      websiteStatus,
      leadScore: calculateLeadScore(websiteStatus, signals),
      homepageTitle: null,
      metaDescription: null,
      responseStatus: null,
      loadTimeMs: null,
      notes: "No website URL provided by Google Places.",
    };
  }

  let normalized = websiteUrl.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  if (isFacebookUrl(normalized)) {
    const signals: AuditSignals = {
      hasWebsite: true,
      isBroken: false,
      isHttps: normalized.startsWith("https"),
      isFacebookOnly: true,
      isOutdated: false,
    };
    const websiteStatus = "FACEBOOK_ONLY";
    return {
      signals,
      websiteStatus,
      leadScore: calculateLeadScore(websiteStatus, signals),
      homepageTitle: null,
      metaDescription: null,
      responseStatus: null,
      loadTimeMs: null,
      notes: "Website URL points to Facebook only.",
    };
  }

  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(normalized, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "ObsidianProspectEngine/1.0 (+https://obsidiansystems.com; lead qualification)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const loadTimeMs = Date.now() - start;
    const isHttps = res.url.startsWith("https://");
    const html = await res.text().catch(() => "");
    const title = extractTitle(html);
    const metaDescription = extractMeta(html, "description");
    const isBroken = !res.ok;
    const isOutdated = looksOutdated(html, title);

    const signals: AuditSignals = {
      hasWebsite: true,
      isBroken,
      isHttps,
      isFacebookOnly: false,
      isOutdated,
    };

    let websiteStatus = websiteStatusFromSignals(signals);
    if (!isBroken && isOutdated) websiteStatus = "OUTDATED_WEBSITE";
    if (isBroken) websiteStatus = "BROKEN_WEBSITE";

    const notes = [
      `Final URL: ${res.url}`,
      `HTTP ${res.status}`,
      loadTimeMs > 3000 ? `Slow load (${loadTimeMs}ms)` : null,
      !isHttps ? "Site not served over HTTPS" : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      signals,
      websiteStatus,
      leadScore: calculateLeadScore(websiteStatus, signals),
      homepageTitle: title,
      metaDescription,
      responseStatus: res.status,
      loadTimeMs,
      notes: notes || null,
    };
  } catch (err) {
    const loadTimeMs = Date.now() - start;
    const signals: AuditSignals = {
      hasWebsite: true,
      isBroken: true,
      isHttps: normalized.startsWith("https"),
      isFacebookOnly: false,
      isOutdated: false,
    };
    const websiteStatus = "BROKEN_WEBSITE";
    const message = err instanceof Error ? err.message : "Request failed";
    return {
      signals,
      websiteStatus,
      leadScore: calculateLeadScore(websiteStatus, signals),
      homepageTitle: null,
      metaDescription: null,
      responseStatus: null,
      loadTimeMs,
      notes: `Could not reach site: ${message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
