import { WebsiteStatus } from "@prisma/client";

export interface AuditSignals {
  hasWebsite: boolean;
  isBroken: boolean;
  isHttps: boolean | null;
  isFacebookOnly: boolean;
  isOutdated: boolean;
}

/** Lead score rules per product spec */
export function calculateLeadScore(
  websiteStatus: WebsiteStatus,
  signals?: Partial<AuditSignals>
): number {
  switch (websiteStatus) {
    case "NO_WEBSITE":
      return 100;
    case "FACEBOOK_ONLY":
      return 90;
    case "BROKEN_WEBSITE":
      return 85;
    case "OUTDATED_WEBSITE":
      return 70;
    case "HAS_WEBSITE":
      if (signals?.isHttps === false) return 75;
      return 20;
    default:
      return 50;
  }
}

export function websiteStatusFromSignals(signals: AuditSignals): WebsiteStatus {
  if (!signals.hasWebsite) return "NO_WEBSITE";
  if (signals.isFacebookOnly) return "FACEBOOK_ONLY";
  if (signals.isBroken) return "BROKEN_WEBSITE";
  if (signals.isOutdated) return "OUTDATED_WEBSITE";
  if (signals.hasWebsite) return "HAS_WEBSITE";
  return "UNKNOWN";
}

export function scoreBadgeVariant(score: number): "high" | "medium" | "low" {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}
