import { WebsiteStatus } from "@prisma/client";

export interface SearchLeadResult {
  placeId: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  websiteStatus: WebsiteStatus;
  leadScore: number;
  businessStatus: string | null;
  types: string[];
  audit?: {
    hasWebsite: boolean;
    isBroken: boolean;
    isHttps: boolean | null;
    isFacebookOnly: boolean;
    homepageTitle: string | null;
    metaDescription: string | null;
    responseStatus: number | null;
    loadTimeMs: number | null;
    notes: string | null;
  } | null;
}

export const WEBSITE_STATUS_LABELS: Record<WebsiteStatus, string> = {
  NO_WEBSITE: "No Website",
  HAS_WEBSITE: "Has Website",
  BROKEN_WEBSITE: "Broken",
  FACEBOOK_ONLY: "Facebook Only",
  OUTDATED_WEBSITE: "Outdated",
  UNKNOWN: "Unknown",
};

export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  SAVED: "Saved",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  NOT_INTERESTED: "Not Interested",
  CLIENT: "Client",
  ARCHIVED: "Archived",
};
