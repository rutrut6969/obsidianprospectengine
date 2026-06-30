import * as XLSX from "xlsx";
import { LeadStatus, Prisma, WebsiteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SessionPayload } from "@/lib/auth/session";
import { buildLeadData } from "@/lib/leads/service";
import { normalizePhone, normalizeText, normalizeWebsite } from "@/lib/leads/normalization";

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const SUPPORTED_IMPORT_EXTENSIONS = [".csv", ".xlsx", ".xls", ".json"] as const;

const STATUS_VALUES = new Set<LeadStatus>([
  "NEW",
  "SAVED",
  "CONTACTED",
  "INTERESTED",
  "NOT_INTERESTED",
  "CLIENT",
  "ARCHIVED",
]);

const WEBSITE_STATUS_VALUES = new Set<WebsiteStatus>([
  "NO_WEBSITE",
  "HAS_WEBSITE",
  "BROKEN_WEBSITE",
  "FACEBOOK_ONLY",
  "OUTDATED_WEBSITE",
  "UNKNOWN",
]);

const FACEBOOK_HOSTS = ["facebook.com", "fb.com", "m.facebook.com", "www.facebook.com"];

const FIELD_ALIASES: Record<string, keyof ImportedLeadInput> = {
  businessname: "businessName",
  name: "businessName",
  category: "category",
  phone: "phone",
  email: "primaryEmail",
  primaryemail: "primaryEmail",
  website: "website",
  websiteurl: "website",
  facebookpage: "facebookUrl",
  facebookurl: "facebookUrl",
  websitestatus: "websiteStatus",
  address: "address",
  city: "city",
  state: "state",
  postalcode: "postalCode",
  zip: "postalCode",
  zipcode: "postalCode",
  leadscore: "leadScore",
  score: "leadScore",
  rating: "rating",
  reviews: "reviewCount",
  reviewcount: "reviewCount",
  status: "status",
  contactstatus: "status",
  notes: "notes",
  tags: "tags",
  source: "source",
  googleplaceid: "googlePlaceId",
  placeid: "googlePlaceId",
  originalsavedleadid: "originalSavedLeadId",
  createdat: "createdAt",
  saveddate: "createdAt",
  createdsaveddate: "createdAt",
  lastcontacteddate: "lastContactedAt",
  lastcontactedat: "lastContactedAt",
  exportedat: "exportedAt",
};

export interface ImportedLeadInput {
  businessName: string;
  category?: string | null;
  phone?: string | null;
  primaryEmail?: string | null;
  website?: string | null;
  facebookUrl?: string | null;
  websiteStatus?: WebsiteStatus | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  leadScore?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  status?: LeadStatus | null;
  notes?: string | null;
  tags?: string[];
  source?: string | null;
  googlePlaceId?: string | null;
  originalSavedLeadId?: string | null;
  createdAt?: string | null;
  lastContactedAt?: string | null;
  exportedAt?: string | null;
}

export interface ImportSummary {
  totalRows: number;
  importedCount: number;
  skippedDuplicateCount: number;
  failedCount: number;
  errors: string[];
  warnings: string[];
  preview: ImportedLeadInput[];
}

type RawRow = Record<string, unknown>;

export interface ParsedImportedLeadFile {
  totalRows: number;
  leads: ImportedLeadInput[];
  errors: string[];
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function cleanString(value: unknown, maxLength = 500): string | null {
  if (value == null) return null;
  const trimmed = String(value).replace(/\0/g, "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanDate(value: unknown): string | null {
  const text = cleanString(value, 80);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function cleanLeadScore(value: unknown): number | null {
  const score = cleanNumber(value);
  if (score == null) return null;
  if (score < 0 || score > 100) throw new Error("Lead Score must be between 0 and 100.");
  return Math.round(score);
}

function cleanRating(value: unknown): number | null {
  const rating = cleanNumber(value);
  if (rating == null) return null;
  if (rating < 0 || rating > 5) throw new Error("Rating must be between 0 and 5.");
  return Math.round(rating * 10) / 10;
}

function cleanReviewCount(value: unknown): number | null {
  const count = cleanNumber(value);
  if (count == null) return null;
  if (count < 0) throw new Error("Reviews must be zero or greater.");
  return Math.round(count);
}

function cleanTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => cleanString(item, 60)).filter(Boolean) as string[];
  }
  const text = cleanString(value, 1000);
  if (!text) return [];
  return text
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function cleanStatus(value: unknown): LeadStatus | null {
  const status = cleanString(value, 40)?.toUpperCase().replace(/\s+/g, "_") as LeadStatus | undefined;
  return status && STATUS_VALUES.has(status) ? status : null;
}

function cleanWebsiteStatus(value: unknown): WebsiteStatus | null {
  const status = cleanString(value, 40)?.toUpperCase().replace(/\s+/g, "_") as WebsiteStatus | undefined;
  return status && WEBSITE_STATUS_VALUES.has(status) ? status : null;
}

function isFacebookUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const raw = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const host = new URL(raw).hostname.toLowerCase();
    return FACEBOOK_HOSTS.some((facebookHost) => host === facebookHost || host.endsWith(`.${facebookHost}`));
  } catch {
    return false;
  }
}

function inferWebsiteStatus(lead: ImportedLeadInput): WebsiteStatus {
  if (lead.websiteStatus) return lead.websiteStatus;
  if (lead.facebookUrl && !lead.website) return "FACEBOOK_ONLY";
  if (isFacebookUrl(lead.website)) return "FACEBOOK_ONLY";
  if (!lead.website) return "NO_WEBSITE";
  return "UNKNOWN";
}

function mapRawRow(row: RawRow, rowNumber: number): { lead?: ImportedLeadInput; error?: string } {
  const normalized: Partial<Record<keyof ImportedLeadInput, unknown>> = {};

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    const mapped = FIELD_ALIASES[normalizedKey];
    if (mapped) normalized[mapped] = value;
  }

  const businessName = cleanString(normalized.businessName, 180);
  if (!businessName) {
    return { error: `Row ${rowNumber}: missing required businessName.` };
  }

  let leadScore: number | null = null;
  let rating: number | null = null;
  let reviewCount: number | null = null;
  try {
    leadScore = cleanLeadScore(normalized.leadScore);
    rating = cleanRating(normalized.rating);
    reviewCount = cleanReviewCount(normalized.reviewCount);
  } catch (error) {
    return { error: `Row ${rowNumber}: ${error instanceof Error ? error.message : "invalid numeric value."}` };
  }

  const lead: ImportedLeadInput = {
    businessName,
    category: cleanString(normalized.category, 120),
    phone: cleanString(normalized.phone, 60),
    primaryEmail: cleanString(normalized.primaryEmail, 180)?.toLowerCase() ?? null,
    website: cleanString(normalized.website, 500),
    facebookUrl: cleanString(normalized.facebookUrl, 500),
    websiteStatus: cleanWebsiteStatus(normalized.websiteStatus),
    address: cleanString(normalized.address, 250),
    city: cleanString(normalized.city, 120),
    state: cleanString(normalized.state, 40)?.toUpperCase() ?? null,
    postalCode: cleanString(normalized.postalCode, 20),
    leadScore,
    rating,
    reviewCount,
    status: cleanStatus(normalized.status),
    notes: cleanString(normalized.notes, 3000),
    tags: cleanTags(normalized.tags),
    source: cleanString(normalized.source, 120),
    googlePlaceId: cleanString(normalized.googlePlaceId, 180),
    originalSavedLeadId: cleanString(normalized.originalSavedLeadId, 180),
    createdAt: cleanDate(normalized.createdAt),
    lastContactedAt: cleanDate(normalized.lastContactedAt),
    exportedAt: cleanString(normalized.exportedAt, 80),
  };

  return { lead: { ...lead, status: lead.status ?? "SAVED" } };
}

function normalizeRawRows(rows: RawRow[]): ParsedImportedLeadFile {
  const leads: ImportedLeadInput[] = [];
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const mapped = mapRawRow(row, index + 2);
    if (mapped.lead) leads.push(mapped.lead);
    if (mapped.error) errors.push(mapped.error);
  });
  if (errors.length === rows.length && errors[0]?.includes("missing required businessName")) {
    throw new Error("Missing required column: businessName.");
  }
  return { totalRows: rows.length, leads, errors };
}

function extensionFor(filename: string): string {
  const lower = filename.toLowerCase();
  return SUPPORTED_IMPORT_EXTENSIONS.find((extension) => lower.endsWith(extension)) ?? "";
}

export function validateImportFile(filename: string, size: number) {
  const extension = extensionFor(filename);
  if (!extension) {
    throw new Error("Unsupported import file type. Upload CSV, XLSX, XLS, or JSON.");
  }
  if (size > MAX_IMPORT_FILE_BYTES) {
    throw new Error("Import file is too large. Maximum size is 5 MB.");
  }
  return extension;
}

export function parseImportedLeadFileFromBuffer(buffer: Buffer, filename: string): ParsedImportedLeadFile {
  const extension = validateImportFile(filename, buffer.byteLength);

  if (extension === ".json") {
    const parsed = JSON.parse(buffer.toString("utf8")) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { leads?: unknown }).leads)
        ? (parsed as { leads: unknown[] }).leads
        : null;
    if (!rows) throw new Error("JSON import must be an array or an object with a leads array.");
    return normalizeRawRows(rows as RawRow[]);
  }

  const workbook = XLSX.read(buffer, { type: "buffer", raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { totalRows: 0, leads: [], errors: [] };
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: "",
    raw: true,
    blankrows: false,
  });
  return normalizeRawRows(rows);
}

export function parseImportedLeadRowsFromBuffer(buffer: Buffer, filename: string): ImportedLeadInput[] {
  return parseImportedLeadFileFromBuffer(buffer, filename).leads;
}

async function findImportDuplicate(lead: ImportedLeadInput, userId: string) {
  const normalizedWebsite = normalizeWebsite(lead.website);
  const normalizedFacebook = normalizeWebsite(lead.facebookUrl);
  const normalizedPhone = normalizePhone(lead.phone);
  const normalizedName = normalizeText(lead.businessName);
  const city = lead.city?.trim();
  const state = lead.state?.trim()?.toUpperCase();
  const OR: Prisma.BusinessLeadWhereInput[] = [];

  if (lead.googlePlaceId) OR.push({ placeId: lead.googlePlaceId });
  if (normalizedWebsite) OR.push({ normalizedWebsite });
  if (normalizedFacebook) OR.push({ normalizedWebsite: normalizedFacebook });
  if (normalizedPhone) OR.push({ normalizedPhone });
  if (normalizedName && city && state) {
    OR.push({ normalizedName, city: { equals: city, mode: "insensitive" }, state });
  }

  if (OR.length === 0) return null;
  return prisma.businessLead.findFirst({
    where: { ownerId: userId, deletedAt: null, OR },
    select: { id: true, name: true },
  });
}

async function placeIdExistsForAnotherOwner(placeId: string | null | undefined, userId: string) {
  if (!placeId) return false;
  const existing = await prisma.businessLead.findUnique({
    where: { placeId },
    select: { ownerId: true },
  });
  return Boolean(existing && existing.ownerId !== userId);
}

export async function importSavedLeads(
  leads: ImportedLeadInput[],
  session: SessionPayload,
  parsed: Pick<ParsedImportedLeadFile, "totalRows" | "errors"> = { totalRows: leads.length, errors: [] }
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    totalRows: parsed.totalRows,
    importedCount: 0,
    skippedDuplicateCount: 0,
    failedCount: parsed.errors.length,
    errors: [...parsed.errors],
    warnings: [],
    preview: leads.slice(0, 5),
  };

  for (const [index, lead] of leads.entries()) {
    try {
      const duplicate = await findImportDuplicate(lead, session.userId);
      if (duplicate) {
        summary.skippedDuplicateCount += 1;
        summary.warnings.push(`Row ${index + 2}: skipped duplicate of ${duplicate.name}.`);
        continue;
      }

      const websiteUrl = lead.website ?? lead.facebookUrl ?? null;
      const websiteStatus = inferWebsiteStatus(lead);
      const input = {
        placeId: lead.googlePlaceId,
        name: lead.businessName,
        category: lead.category,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        phone: lead.phone,
        websiteUrl,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
        websiteStatus,
        leadScore: lead.leadScore ?? (websiteStatus === "NO_WEBSITE" ? 100 : websiteStatus === "FACEBOOK_ONLY" ? 90 : 0),
        notes: lead.notes,
        status: lead.status ?? "SAVED",
      };
      const data = buildLeadData(input, session);
      data.primaryEmail = lead.primaryEmail ?? null;
      data.tags = lead.tags ?? [];
      if (await placeIdExistsForAnotherOwner(lead.googlePlaceId, session.userId)) {
        data.placeId = null;
      }

      await prisma.$transaction(async (tx) => {
        const created = await tx.businessLead.create({ data });
        const contactMethods: Prisma.ContactMethodCreateManyInput[] = [];
        if (lead.primaryEmail) {
          contactMethods.push({
            businessLeadId: created.id,
            type: "EMAIL",
            value: lead.primaryEmail,
            isPrimary: true,
          });
        }
        if (lead.facebookUrl) {
          contactMethods.push({
            businessLeadId: created.id,
            type: "FACEBOOK",
            value: lead.facebookUrl,
            isPrimary: false,
          });
        }
        if (websiteUrl) {
          contactMethods.push({
            businessLeadId: created.id,
            type: "WEBSITE",
            value: websiteUrl,
            isPrimary: false,
          });
        }
        if (contactMethods.length > 0) {
          await tx.contactMethod.createMany({
            data: contactMethods,
            skipDuplicates: true,
          });
        }
        await tx.leadActivity.create({
          data: {
            businessLeadId: created.id,
            userId: session.userId,
            type: "LEAD_UPDATED",
            title: "Lead imported",
            body: "Lead was imported into this saved leads workspace.",
            metadata: {
              importedSource: lead.source ?? "uploaded-file",
              originalSavedLeadId: lead.originalSavedLeadId,
              originalCreatedAt: lead.createdAt,
              originalLastContactedAt: lead.lastContactedAt,
              exportedAt: lead.exportedAt,
              importedAt: new Date().toISOString(),
            },
          },
        });
      });

      summary.importedCount += 1;
    } catch (error) {
      summary.failedCount += 1;
      summary.errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Import failed."}`);
    }
  }

  if (summary.totalRows === 0) {
    summary.warnings.push("No valid leads were found in the uploaded file.");
  }

  return summary;
}
