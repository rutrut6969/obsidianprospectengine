import { WebsiteStatus } from "@prisma/client";

export const MIN_VISIBLE_LEAD_SCORE = 85;

export type LeadSearchWebsiteFilter = "ALL" | "NO_WEBSITE" | "FACEBOOK_ONLY";

export const LEAD_SEARCH_WEBSITE_FILTER_LABELS: Record<LeadSearchWebsiteFilter, string> = {
  ALL: "All qualifying leads",
  NO_WEBSITE: "No website",
  FACEBOOK_ONLY: "Facebook only",
};

export interface LeadSearchFilterable {
  leadScore: number;
  websiteStatus: WebsiteStatus;
}

export function isQualifyingLead(
  lead: LeadSearchFilterable,
  websiteFilter: LeadSearchWebsiteFilter = "ALL"
): boolean {
  if (lead.leadScore < MIN_VISIBLE_LEAD_SCORE) return false;
  if (websiteFilter === "ALL") return true;
  return lead.websiteStatus === websiteFilter;
}

export function parseLeadSearchWebsiteFilter(value: unknown): LeadSearchWebsiteFilter {
  if (value === "NO_WEBSITE" || value === "FACEBOOK_ONLY") return value;
  return "ALL";
}

