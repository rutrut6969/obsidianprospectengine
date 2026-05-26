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
  mobileFriendly: boolean | null;
  brokenLinks: number | null;
  pageSpeedScore: number | null;
  accessibilityNotes: string | null;
  seoNotes: string | null;
  responsivenessNotes: string | null;
  ctaQuality: string | null;
  professionalismScore: number | null;
  summary: string | null;
  weaknesses: string[];
  improvements: string[];
  leadQualityScore: number | null;
  conversionOpportunityScore: number | null;
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

function analyzeWebsiteQuality(html: string, loadTimeMs: number, isHttps: boolean) {
  const lower = html.toLowerCase();
  const hasViewport = lower.includes('name="viewport"') || lower.includes("name='viewport'");
  const hasForms = /<form[\s>]/i.test(html);
  const hasPhoneLink = lower.includes("tel:");
  const hasCta =
    lower.includes("contact us") ||
    lower.includes("book now") ||
    lower.includes("schedule") ||
    lower.includes("request a quote") ||
    lower.includes("get a quote");
  const hasAltText = /<img[^>]+alt=["'][^"']+["']/i.test(html);
  const brokenLinks = (html.match(/href=["']#["']/gi) ?? []).length;
  const pageSpeedScore = Math.max(20, Math.min(100, 100 - Math.round(loadTimeMs / 120)));
  const professionalismScore = Math.max(
    10,
    Math.min(
      100,
      55 +
        (isHttps ? 10 : -10) +
        (hasViewport ? 10 : -15) +
        (hasCta ? 10 : -10) +
        (hasForms || hasPhoneLink ? 8 : -5) +
        (loadTimeMs < 2500 ? 7 : -8)
    )
  );

  const weaknesses = [
    !isHttps ? "Website does not appear to use HTTPS." : null,
    !hasViewport ? "Mobile viewport metadata was not detected." : null,
    !hasCta ? "Clear conversion CTA was not detected on the homepage." : null,
    !hasForms && !hasPhoneLink ? "Fast contact path was not detected." : null,
    loadTimeMs > 3000 ? "Homepage load time may be slow." : null,
    brokenLinks > 0 ? "Placeholder or broken anchor links were detected." : null,
  ].filter(Boolean) as string[];

  const improvements = [
    !hasViewport ? "Add responsive mobile layout and viewport metadata." : null,
    !hasCta ? "Add a prominent quote, booking, or contact CTA above the fold." : null,
    !isHttps ? "Configure SSL and redirect HTTP traffic to HTTPS." : null,
    !hasAltText ? "Add descriptive image alt text for accessibility." : null,
    loadTimeMs > 3000 ? "Compress assets and reduce render-blocking resources." : null,
  ].filter(Boolean) as string[];

  return {
    mobileFriendly: hasViewport,
    brokenLinks,
    pageSpeedScore,
    accessibilityNotes: hasAltText
      ? "Some image alt text detected."
      : "Image alt text was not detected in the homepage sample.",
    seoNotes: lower.includes("name=\"description\"") || lower.includes("name='description'")
      ? "Meta description detected."
      : "Meta description was not detected.",
    responsivenessNotes: hasViewport
      ? "Viewport metadata suggests mobile responsiveness."
      : "No viewport metadata found; mobile friendliness should be reviewed.",
    ctaQuality: hasCta ? "CTA language detected." : "No obvious CTA language detected.",
    professionalismScore,
    summary:
      weaknesses.length > 0
        ? "Automated audit found several opportunities to improve trust, usability, or conversion."
        : "Automated audit found a generally healthy web presence.",
    weaknesses,
    improvements,
  };
}

function emptyAnalysis(summary: string): Pick<
  WebsiteAuditResult,
  | "mobileFriendly"
  | "brokenLinks"
  | "pageSpeedScore"
  | "accessibilityNotes"
  | "seoNotes"
  | "responsivenessNotes"
  | "ctaQuality"
  | "professionalismScore"
  | "summary"
  | "weaknesses"
  | "improvements"
  | "leadQualityScore"
  | "conversionOpportunityScore"
> {
  return {
    mobileFriendly: null,
    brokenLinks: null,
    pageSpeedScore: null,
    accessibilityNotes: null,
    seoNotes: null,
    responsivenessNotes: null,
    ctaQuality: null,
    professionalismScore: null,
    summary,
    weaknesses: [summary],
    improvements: ["Create or improve the business website to capture more local demand."],
    leadQualityScore: null,
    conversionOpportunityScore: null,
  };
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
      ...emptyAnalysis("No dedicated website was found for this lead."),
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
      ...emptyAnalysis("Online presence appears to rely on Facebook instead of a dedicated website."),
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
    const quality = analyzeWebsiteQuality(html, loadTimeMs, isHttps);

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
      ...quality,
      leadQualityScore: calculateLeadScore(websiteStatus, signals),
      conversionOpportunityScore: Math.max(
        10,
        Math.min(100, 100 - quality.professionalismScore + calculateLeadScore(websiteStatus, signals) / 3)
      ),
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
      ...emptyAnalysis("Website could not be reached during the audit."),
      leadQualityScore: calculateLeadScore(websiteStatus, signals),
      conversionOpportunityScore: 85,
    };
  } finally {
    clearTimeout(timeout);
  }
}
