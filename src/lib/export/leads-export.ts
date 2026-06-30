import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { join } from "node:path";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { ActivityType, ExportFormat, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SessionPayload } from "@/lib/auth/session";
import { leadVisibilityWhere } from "@/lib/auth/access";

export type LeadExportFormat = ExportFormat | "JSON";

export const EXPORT_COLUMNS = [
  "name",
  "category",
  "phone",
  "primaryEmail",
  "websiteUrl",
  "facebookPage",
  "address",
  "city",
  "state",
  "websiteStatus",
  "leadScore",
  "rating",
  "reviewCount",
  "status",
  "notes",
  "tags",
  "createdAt",
  "lastContactedAt",
] as const;

type ExportColumn = (typeof EXPORT_COLUMNS)[number];

const HEADERS: Record<ExportColumn, string> = {
  name: "Business Name",
  category: "Category",
  phone: "Phone",
  primaryEmail: "Email",
  websiteUrl: "Website",
  facebookPage: "Facebook Page",
  address: "Address",
  city: "City",
  state: "State",
  websiteStatus: "Website Status",
  leadScore: "Lead Score",
  rating: "Rating",
  reviewCount: "Reviews",
  status: "Contact Status",
  notes: "Notes",
  tags: "Tags",
  createdAt: "Created/Saved Date",
  lastContactedAt: "Last Contacted Date",
};

const CONTACT_ACTIVITY_TYPES: ActivityType[] = [
  "EMAIL",
  "SMS",
  "CALL",
  "AI_CALL",
  "VOICEMAIL",
  "OUTREACH_SENT",
  "FOLLOW_UP",
  "APPOINTMENT_SET",
];

const FACEBOOK_HOSTS = ["facebook.com", "fb.com", "m.facebook.com", "www.facebook.com"];
const PDF_FONT_NAME = "OpeNotoSans";
const PDF_FONT_PATH = join(process.cwd(), "src/assets/fonts/NotoSans-Regular.ttf");
const PDF_PAGE_MARGIN = 48;
const PDF_CARD_GAP = 16;
const PDF_MIN_CARD_HEIGHT = 266;
const PDF_MAX_CARDS_PER_PAGE = 2;

const ALLOWED_SORTS = new Set([
  "leadScore",
  "category",
  "city",
  "websiteStatus",
  "reviewCount",
  "createdAt",
  "updatedAt",
  "status",
]);

type ExportLead = Prisma.BusinessLeadGetPayload<{
  include: {
    contactMethods: true;
    outreachLogs: { orderBy: { sentAt: "desc" }; take: 1 };
    activities: {
      where: { type: { in: typeof CONTACT_ACTIVITY_TYPES } };
      orderBy: { createdAt: "desc" };
      take: 1;
    };
  };
}>;

type ExportFilters = {
  status?: string | null;
  q?: string | null;
  minScore?: string | null;
  category?: string | null;
  websiteStatus?: string | null;
  ownership?: string | null;
  city?: string | null;
  state?: string | null;
  sort?: string | null;
  direction?: string | null;
};

export interface ImportableLeadExportRow {
  businessName: string;
  category: string | null;
  phone: string | null;
  primaryEmail: string | null;
  website: string | null;
  facebookUrl: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  leadScore: number;
  status: string;
  notes: string | null;
  tags: string[];
  source: string;
  googlePlaceId: string | null;
  originalSavedLeadId: string;
  createdAt: string;
  exportedAt: string;
}

export function parseExportColumns(value: string | null): ExportColumn[] {
  if (!value) return [...EXPORT_COLUMNS];
  const requested = value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is ExportColumn =>
      EXPORT_COLUMNS.includes(item as ExportColumn)
    );
  return requested.length > 0 ? requested : [...EXPORT_COLUMNS];
}

export async function getExportLeads(filters: {
  status?: string | null;
  q?: string | null;
  minScore?: string | null;
  category?: string | null;
  websiteStatus?: string | null;
  ownership?: string | null;
  city?: string | null;
  state?: string | null;
  sort?: string | null;
  direction?: string | null;
}, session?: SessionPayload) {
  const whereFilters: Prisma.BusinessLeadWhereInput[] = [
    { deletedAt: null },
    ...(session ? [leadVisibilityWhere(session)] : []),
  ];

  if (filters.status) whereFilters.push({ status: filters.status as never });
  if (filters.category) whereFilters.push({ category: { equals: filters.category, mode: "insensitive" } });
  if (filters.websiteStatus) whereFilters.push({ websiteStatus: filters.websiteStatus as never });
  if (filters.city) whereFilters.push({ city: { equals: filters.city, mode: "insensitive" } });
  if (filters.state) whereFilters.push({ state: { equals: filters.state.toUpperCase(), mode: "insensitive" } });
  if (filters.minScore) whereFilters.push({ leadScore: { gte: Number(filters.minScore) } });
  if (filters.ownership === "mine" && session) {
    whereFilters.push({ ownerId: session.userId });
  } else if (filters.ownership === "global") {
    whereFilters.push({ visibility: "GLOBAL" });
  }
  if (filters.q) {
    whereFilters.push({
      OR: [
        { name: { contains: filters.q, mode: "insensitive" } },
        { category: { contains: filters.q, mode: "insensitive" } },
        { city: { contains: filters.q, mode: "insensitive" } },
        { state: { contains: filters.q, mode: "insensitive" } },
        { phone: { contains: filters.q, mode: "insensitive" } },
        { primaryEmail: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }

  const direction = filters.direction === "asc" ? "asc" : "desc";
  const sort = filters.sort && ALLOWED_SORTS.has(filters.sort) ? filters.sort : "leadScore";
  const orderBy: Prisma.BusinessLeadOrderByWithRelationInput[] =
    sort === "category"
      ? [{ category: direction }, { name: "asc" }]
      : sort === "city"
        ? [{ city: direction }, { name: "asc" }]
        : sort === "websiteStatus"
          ? [{ websiteStatus: direction }, { leadScore: "desc" }]
          : sort === "reviewCount"
            ? [{ reviewCount: direction }, { leadScore: "desc" }]
            : sort === "createdAt"
              ? [{ createdAt: direction }]
              : sort === "updatedAt"
                ? [{ updatedAt: direction }]
                : sort === "status"
                  ? [{ status: direction }, { updatedAt: "desc" }]
                  : [{ leadScore: direction }, { updatedAt: "desc" }];

  return prisma.businessLead.findMany({
    where: { AND: whereFilters },
    orderBy,
    include: {
      contactMethods: true,
      outreachLogs: { orderBy: { sentAt: "desc" }, take: 1 },
      activities: {
        where: { type: { in: CONTACT_ACTIVITY_TYPES } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    take: 1000,
  });
}

function isFacebookUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return FACEBOOK_HOSTS.some((facebookHost) => host === facebookHost || host.endsWith(`.${facebookHost}`));
  } catch {
    return false;
  }
}

function formatDate(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function facebookPageFor(row: ExportLead): string {
  const explicitFacebook = row.contactMethods.find((method) => method.type === "FACEBOOK")?.value;
  if (explicitFacebook) return explicitFacebook;
  return isFacebookUrl(row.websiteUrl) ? row.websiteUrl ?? "" : "";
}

function lastContactedAt(row: ExportLead): Date | null {
  const logDate = row.outreachLogs[0]?.sentAt ?? null;
  const activityDate = row.activities[0]?.createdAt ?? null;
  if (logDate && activityDate) return logDate > activityDate ? logDate : activityDate;
  return logDate ?? activityDate;
}

export function valueFor(row: ExportLead, column: ExportColumn): string {
  if (column === "primaryEmail") return row.primaryEmail ?? "";
  if (column === "facebookPage") return facebookPageFor(row);
  if (column === "tags") return row.tags.join(", ");
  if (column === "createdAt") return formatDate(row.createdAt);
  if (column === "lastContactedAt") return formatDate(lastContactedAt(row));
  const value = row[column];
  if (value == null) return "";
  return String(value);
}

export function toImportableLeadRows(
  leads: ExportLead[],
  exportedAt = new Date()
): ImportableLeadExportRow[] {
  return leads.map((lead) => ({
    businessName: lead.name,
    category: lead.category,
    phone: lead.phone,
    primaryEmail: lead.primaryEmail,
    website: lead.websiteUrl,
    facebookUrl: facebookPageFor(lead) || null,
    address: lead.address,
    city: lead.city,
    state: lead.state,
    postalCode: null,
    leadScore: lead.leadScore,
    status: lead.status,
    notes: lead.notes,
    tags: lead.tags,
    source: "obsidian-prospect-engine",
    googlePlaceId: lead.placeId,
    originalSavedLeadId: lead.id,
    createdAt: lead.createdAt.toISOString(),
    exportedAt: exportedAt.toISOString(),
  }));
}

function tableRows(leads: ExportLead[], columns: ExportColumn[]) {
  return leads.map((lead) => {
    const row: Record<string, string> = {};
    for (const column of columns) row[HEADERS[column]] = valueFor(lead, column);
    return row;
  });
}

export function renderCsv(leads: ExportLead[], columns: ExportColumn[]): Buffer {
  const rows = [columns.map((column) => HEADERS[column])];
  rows.push(...leads.map((lead) => columns.map((column) => valueFor(lead, column))));
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\r\n");
  return Buffer.from(csv, "utf8");
}

export function renderXlsx(leads: ExportLead[], columns: ExportColumn[]): Buffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(tableRows(leads, columns));
  XLSX.utils.book_append_sheet(workbook, worksheet, "Saved Leads");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function renderJson(leads: ExportLead[]): Buffer {
  const exportedAt = new Date();
  return Buffer.from(
    JSON.stringify(
      {
        source: "obsidian-prospect-engine",
        schema: "saved-leads-import-v1",
        exportedAt: exportedAt.toISOString(),
        leads: toImportableLeadRows(leads, exportedAt),
      },
      null,
      2
    ),
    "utf8"
  );
}

export async function renderDocx(leads: ExportLead[], columns: ExportColumn[]): Promise<Buffer> {
  const rows = [
    new TableRow({
      children: columns.map(
        (column) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: HEADERS[column], bold: true })] })],
          })
      ),
    }),
    ...leads.map(
      (lead) =>
        new TableRow({
          children: columns.map(
            (column) =>
              new TableCell({
                children: [new Paragraph(valueFor(lead, column))],
              })
          ),
        })
    ),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: "Obsidian Prospect Engine Saved Leads Export", bold: true, size: 28 })],
          }),
          new Paragraph(`Generated ${new Date().toLocaleString()} with ${leads.length} saved leads.`),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows,
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function websiteStatusLabel(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return titleCase(value);
}

function statusLabel(value: string | null | undefined): string {
  if (!value) return "Saved";
  return titleCase(value);
}

function statusBadgeColor(label: string) {
  if (label === "No Website") return { fill: "#fee2e2", stroke: "#fecaca", text: "#991b1b" };
  if (label === "Facebook Only") return { fill: "#dbeafe", stroke: "#bfdbfe", text: "#1d4ed8" };
  if (label === "Contacted") return { fill: "#dcfce7", stroke: "#bbf7d0", text: "#166534" };
  if (label === "Saved") return { fill: "#f1f5f9", stroke: "#cbd5e1", text: "#334155" };
  return { fill: "#f8fafc", stroke: "#e2e8f0", text: "#475569" };
}

function activeFilterLines(filters?: ExportFilters): string[] {
  if (!filters) return ["All saved leads"];
  const labels: Record<keyof ExportFilters, string> = {
    status: "Status",
    q: "Search",
    minScore: "Minimum score",
    category: "Category",
    websiteStatus: "Website status",
    ownership: "Ownership",
    city: "City",
    state: "State",
    sort: "Sort",
    direction: "Direction",
  };
  const lines = Object.entries(filters)
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(([key, value]) => `${labels[key as keyof ExportFilters]}: ${value}`);
  return lines.length > 0 ? lines : ["All saved leads"];
}

function officialWebsiteFor(lead: ExportLead): string {
  if (!lead.websiteUrl || isFacebookUrl(lead.websiteUrl) || lead.websiteStatus === "FACEBOOK_ONLY") {
    return "No official website.";
  }
  return lead.websiteUrl;
}

function addressFor(lead: ExportLead): string {
  const streetOrFormatted = lead.address?.trim();
  const city = lead.city?.trim();
  const state = lead.state?.trim();
  const cityState = [city, state].filter(Boolean).join(", ");
  if (!streetOrFormatted) return cityState;
  const lowerAddress = streetOrFormatted.toLowerCase();
  const hasCity = city ? lowerAddress.includes(city.toLowerCase()) : false;
  const hasState = state ? lowerAddress.includes(state.toLowerCase()) : false;
  if (hasCity || hasState || !cityState) return streetOrFormatted;
  return `${streetOrFormatted}\n${cityState}`;
}

function ratingFor(lead: ExportLead): string {
  if (lead.rating == null && lead.reviewCount == null) return "No rating";
  if (lead.rating == null) return `${lead.reviewCount ?? 0} reviews`;
  return `${lead.rating.toFixed(1)} stars (${lead.reviewCount ?? 0} reviews)`;
}

function summaryStats(leads: ExportLead[]) {
  const noWebsiteCount = leads.filter((lead) => lead.websiteStatus === "NO_WEBSITE").length;
  const facebookOnlyCount = leads.filter((lead) => lead.websiteStatus === "FACEBOOK_ONLY").length;
  const averageScore =
    leads.length > 0
      ? Math.round(leads.reduce((total, lead) => total + lead.leadScore, 0) / leads.length)
      : 0;
  const ratedLeads = leads.filter((lead) => lead.rating != null);
  const averageRating =
    ratedLeads.length > 0
      ? ratedLeads.reduce((total, lead) => total + (lead.rating ?? 0), 0) / ratedLeads.length
      : null;
  const totalReviews = leads.reduce((total, lead) => total + (lead.reviewCount ?? 0), 0);
  return { noWebsiteCount, facebookOnlyCount, averageScore, averageRating, totalReviews };
}

function opportunityFor(lead: ExportLead): string[] {
  const opportunities: string[] = [];
  if (lead.websiteStatus === "NO_WEBSITE") opportunities.push("No official website found");
  if (lead.websiteStatus === "FACEBOOK_ONLY") opportunities.push("Facebook-only web presence");
  if (!lead.primaryEmail) opportunities.push("No email found");
  if ((lead.reviewCount ?? 0) >= 50) opportunities.push("High review count");
  if (lead.leadScore >= 90) opportunities.push("High lead score");
  if (!lead.phone) opportunities.push("Phone number needs discovery");
  return opportunities.length > 0 ? opportunities : ["Review fit and outreach timing"];
}

function leadGroups(leads: ExportLead[]) {
  const order = ["NO_WEBSITE", "FACEBOOK_ONLY", "BROKEN_WEBSITE", "OUTDATED_WEBSITE", "HAS_WEBSITE", "UNKNOWN"];
  const groups = new Map<string, ExportLead[]>();
  for (const lead of leads) {
    const key = lead.websiteStatus ?? "UNKNOWN";
    groups.set(key, [...(groups.get(key) ?? []), lead]);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    return (indexA === -1 ? order.length : indexA) - (indexB === -1 ? order.length : indexB);
  });
}

function ensurePdfSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - PDF_PAGE_MARGIN) {
    doc.addPage();
  }
}

function drawBadge(doc: PDFKit.PDFDocument, label: string, x: number, y: number) {
  const colors = statusBadgeColor(label);
  doc.font(PDF_FONT_NAME).fontSize(7);
  const width = doc.widthOfString(label) + 14;
  doc.roundedRect(x, y, width, 15, 7).fillAndStroke(colors.fill, colors.stroke);
  doc.fillColor(colors.text).text(label, x + 7, y + 4, { width: width - 14, lineBreak: false });
  return width;
}

function textHeight(doc: PDFKit.PDFDocument, text: string, width: number, fontSize = 9) {
  doc.font(PDF_FONT_NAME).fontSize(fontSize);
  return doc.heightOfString(text || "-", { width });
}

function leadCardHeight(doc: PDFKit.PDFDocument, lead: ExportLead, width: number) {
  const contentWidth = width - 36;
  const columnWidth = (contentWidth - 22) / 2;
  const nameHeight = textHeight(doc, lead.name, contentWidth - 100, 16);
  const notes = lead.notes?.trim() || "";
  const tags = lead.tags.length > 0 ? lead.tags.join(", ") : "";
  const opportunities = opportunityFor(lead);
  const leftRows = [
    lead.category ?? "Uncategorized",
    `Website status: ${websiteStatusLabel(lead.websiteStatus)}`,
    ratingFor(lead),
    opportunities.join("; "),
  ];
  const rightRows = [
    lead.phone ?? "No phone",
    lead.primaryEmail ?? "No email",
    officialWebsiteFor(lead),
    facebookPageFor(lead) || "No Facebook page",
    addressFor(lead) || "No address",
  ];
  const leftHeight = leftRows.reduce((total, row) => total + textHeight(doc, row, columnWidth, 8) + 13, 0);
  const rightHeight = rightRows.reduce((total, row) => total + textHeight(doc, row, columnWidth, 8) + 13, 0);
  const notesHeight = notes ? textHeight(doc, notes, contentWidth, 8) + 18 : 0;
  const tagsHeight = tags ? textHeight(doc, tags, contentWidth, 8) + 16 : 0;
  return Math.max(
    PDF_MIN_CARD_HEIGHT,
    34 + nameHeight + 20 + Math.max(leftHeight, rightHeight) + notesHeight + tagsHeight + 58
  );
}

function drawKeyValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) {
  doc.font(PDF_FONT_NAME).fontSize(6.5).fillColor("#64748b").text(label.toUpperCase(), x, y, {
    width,
    lineBreak: false,
  });
  doc.font(PDF_FONT_NAME).fontSize(8).fillColor("#0f172a").text(value || "-", x, y + 9, {
    width,
  });
  return y + 9 + doc.heightOfString(value || "-", { width }) + 6;
}

function drawScoreBlock(doc: PDFKit.PDFDocument, lead: ExportLead, x: number, y: number) {
  doc.roundedRect(x, y, 76, 46, 8).fillAndStroke("#0f172a", "#0f172a");
  doc.font(PDF_FONT_NAME).fontSize(7).fillColor("#cbd5e1").text("SCORE", x, y + 8, {
    width: 76,
    align: "center",
    lineBreak: false,
  });
  doc.font(PDF_FONT_NAME).fontSize(18).fillColor("#ffffff").text(`${lead.leadScore}`, x, y + 20, {
    width: 76,
    align: "center",
    lineBreak: false,
  });
}

function drawWritingLine(doc: PDFKit.PDFDocument, label: string, x: number, y: number, width: number) {
  doc.font(PDF_FONT_NAME).fontSize(7).fillColor("#64748b").text(label, x, y, { width: 80, lineBreak: false });
  doc.moveTo(x + 78, y + 9).lineTo(x + width, y + 9).strokeColor("#cbd5e1").lineWidth(0.7).stroke();
}

function drawLeadCard(doc: PDFKit.PDFDocument, lead: ExportLead, width: number, cardsOnPage: number) {
  const height = leadCardHeight(doc, lead, width);
  if (cardsOnPage >= PDF_MAX_CARDS_PER_PAGE) {
    doc.addPage();
  }
  ensurePdfSpace(doc, height + PDF_CARD_GAP);
  const x = PDF_PAGE_MARGIN;
  const y = doc.y;
  const contentX = x + 18;
  const contentY = y + 16;
  const contentWidth = width - 36;
  const columnWidth = (contentWidth - 22) / 2;

  doc.roundedRect(x + 1, y + 2, width, height, 10).fill("#e2e8f0");
  doc.roundedRect(x, y, width, height, 10).fillAndStroke("#ffffff", "#cbd5e1");
  doc.rect(x, y, width, 4).fill("#0f172a");

  doc.font(PDF_FONT_NAME).fontSize(16).fillColor("#0f172a").text(lead.name, contentX, contentY, {
    width: contentWidth - 100,
  });
  drawScoreBlock(doc, lead, x + width - 94, contentY - 2);
  const badgeY = contentY + Math.max(24, doc.heightOfString(lead.name, { width: contentWidth - 100 })) + 4;
  let badgeX = contentX;
  badgeX += drawBadge(doc, websiteStatusLabel(lead.websiteStatus), badgeX, badgeY) + 6;
  drawBadge(doc, statusLabel(lead.status), badgeX, badgeY);

  let leftY = badgeY + 24;
  leftY = drawKeyValue(doc, "Category", lead.category ?? "Uncategorized", contentX, leftY, columnWidth);
  leftY = drawKeyValue(doc, "Website Status", websiteStatusLabel(lead.websiteStatus), contentX, leftY, columnWidth);
  leftY = drawKeyValue(doc, "Rating / Reviews", ratingFor(lead), contentX, leftY, columnWidth);
  leftY = drawKeyValue(doc, "Opportunity", opportunityFor(lead).join("; "), contentX, leftY, columnWidth);

  let rightY = badgeY + 24;
  const rightX = contentX + columnWidth + 22;
  rightY = drawKeyValue(doc, "Phone", lead.phone ?? "No phone", rightX, rightY, columnWidth);
  rightY = drawKeyValue(doc, "Email", lead.primaryEmail ?? "No email", rightX, rightY, columnWidth);
  rightY = drawKeyValue(doc, "Website", officialWebsiteFor(lead), rightX, rightY, columnWidth);
  rightY = drawKeyValue(doc, "Facebook", facebookPageFor(lead) || "No Facebook page", rightX, rightY, columnWidth);
  rightY = drawKeyValue(doc, "Address", addressFor(lead) || "No address", rightX, rightY, columnWidth);

  let detailY = Math.max(leftY, rightY) + 2;
  if (lead.notes?.trim()) {
    detailY = drawKeyValue(doc, "Notes", lead.notes.trim(), contentX, detailY, contentWidth);
  }
  if (lead.tags.length > 0) {
    detailY = drawKeyValue(doc, "Tags", lead.tags.join(", "), contentX, detailY, contentWidth);
  }

  const trackingY = Math.max(detailY + 2, y + height - 108);
  doc.moveTo(contentX, trackingY - 7).lineTo(x + width - 18, trackingY - 7).strokeColor("#e2e8f0").lineWidth(0.8).stroke();
  drawWritingLine(doc, "Notes:", contentX, trackingY, contentWidth);
  drawWritingLine(doc, "Contacted Date:", contentX, trackingY + 18, contentWidth / 2 - 8);
  drawWritingLine(doc, "Follow-up Date:", contentX + contentWidth / 2 + 8, trackingY + 18, contentWidth / 2 - 8);

  doc.y = y + height + PDF_CARD_GAP;
  return doc.y >= doc.page.height - PDF_PAGE_MARGIN - PDF_MIN_CARD_HEIGHT ? 0 : cardsOnPage + 1;
}

function drawPdfHeader(doc: PDFKit.PDFDocument, leads: ExportLead[], filters?: ExportFilters) {
  const generatedAt = new Date();
  const pageWidth = doc.page.width - PDF_PAGE_MARGIN * 2;
  const stats = summaryStats(leads);

  doc.font(PDF_FONT_NAME).fontSize(22).fillColor("#0f172a").text("Obsidian Prospect Engine", PDF_PAGE_MARGIN, PDF_PAGE_MARGIN);
  doc.font(PDF_FONT_NAME).fontSize(10).fillColor("#475569").text("Saved Leads Prospect Packet", PDF_PAGE_MARGIN, doc.y + 2);
  doc.moveDown(1.2);

  const summaryTop = doc.y;
  const cardWidth = (pageWidth - 20) / 3;
  const summary = [
    ["Export Date", generatedAt.toLocaleString()],
    ["Total Leads", String(leads.length)],
    ["Average Score", leads.length > 0 ? `${stats.averageScore} / 100` : "-"],
  ];
  summary.forEach(([label, value], index) => {
    const x = PDF_PAGE_MARGIN + index * (cardWidth + 10);
    doc.roundedRect(x, summaryTop, cardWidth, 42, 6).fillAndStroke("#f8fafc", "#e2e8f0");
    doc.font(PDF_FONT_NAME).fontSize(7).fillColor("#64748b").text(label.toUpperCase(), x + 10, summaryTop + 9, { width: cardWidth - 20 });
    doc.font(PDF_FONT_NAME).fontSize(10).fillColor("#0f172a").text(value, x + 10, summaryTop + 22, { width: cardWidth - 20 });
  });
  doc.y = summaryTop + 58;

  const statTop = doc.y;
  const smallCardWidth = (pageWidth - 32) / 5;
  const smallStats = [
    ["No Website", String(stats.noWebsiteCount)],
    ["Facebook Only", String(stats.facebookOnlyCount)],
    ["Avg Rating", stats.averageRating == null ? "-" : stats.averageRating.toFixed(1)],
    ["Total Reviews", String(stats.totalReviews)],
    ["Groups", String(leadGroups(leads).length)],
  ];
  smallStats.forEach(([label, value], index) => {
    const x = PDF_PAGE_MARGIN + index * (smallCardWidth + 8);
    doc.roundedRect(x, statTop, smallCardWidth, 34, 5).fillAndStroke("#ffffff", "#e2e8f0");
    doc.font(PDF_FONT_NAME).fontSize(6).fillColor("#64748b").text(label.toUpperCase(), x + 7, statTop + 7, {
      width: smallCardWidth - 14,
      lineBreak: false,
    });
    doc.font(PDF_FONT_NAME).fontSize(10).fillColor("#0f172a").text(value, x + 7, statTop + 18, {
      width: smallCardWidth - 14,
      lineBreak: false,
    });
  });
  doc.y = statTop + 48;

  doc.font(PDF_FONT_NAME).fontSize(8).fillColor("#64748b").text("ACTIVE FILTERS", PDF_PAGE_MARGIN, doc.y);
  doc.moveDown(0.4);
  doc.font(PDF_FONT_NAME).fontSize(9).fillColor("#334155");
  for (const line of activeFilterLines(filters)) {
    doc.text(line, { width: pageWidth });
  }
  doc.moveDown(1);
  doc.moveTo(PDF_PAGE_MARGIN, doc.y).lineTo(doc.page.width - PDF_PAGE_MARGIN, doc.y).strokeColor("#cbd5e1").stroke();
  doc.moveDown(1);
}

export async function renderPdf(
  leads: ExportLead[],
  _columns: ExportColumn[],
  options: { filters?: ExportFilters } = {}
): Promise<Buffer> {
  const doc = new PDFDocument({
    margin: PDF_PAGE_MARGIN,
    size: "LETTER",
    layout: "portrait",
    font: PDF_FONT_PATH,
    bufferPages: true,
  });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.registerFont(PDF_FONT_NAME, PDF_FONT_PATH);
  doc.font(PDF_FONT_NAME);
  const pageWidth = doc.page.width - PDF_PAGE_MARGIN * 2;

  drawPdfHeader(doc, leads, options.filters);

  if (leads.length === 0) {
    doc.roundedRect(PDF_PAGE_MARGIN, doc.y, pageWidth, 82, 8).fillAndStroke("#ffffff", "#dbe3ef");
    doc.font(PDF_FONT_NAME).fontSize(13).fillColor("#0f172a").text("No saved leads matched this export.", PDF_PAGE_MARGIN + 16, doc.y + 20, {
      width: pageWidth - 32,
    });
  } else {
    for (const [group, groupLeads] of leadGroups(leads)) {
      ensurePdfSpace(doc, 86);
      const sectionY = doc.y;
      doc.roundedRect(PDF_PAGE_MARGIN, sectionY, pageWidth, 34, 7).fillAndStroke("#f8fafc", "#dbe3ef");
      doc.font(PDF_FONT_NAME).fontSize(13).fillColor("#0f172a").text(websiteStatusLabel(group), PDF_PAGE_MARGIN + 14, sectionY + 9, {
        width: pageWidth - 120,
        lineBreak: false,
      });
      doc.font(PDF_FONT_NAME).fontSize(8).fillColor("#64748b").text(`${groupLeads.length} leads`, PDF_PAGE_MARGIN + pageWidth - 90, sectionY + 12, {
        width: 76,
        align: "right",
        lineBreak: false,
      });
      doc.y = sectionY + 48;

      let cardsOnPage = 0;
      for (const lead of groupLeads) {
        const beforePage = doc.bufferedPageRange().count;
        cardsOnPage = drawLeadCard(doc, lead, pageWidth, cardsOnPage);
        const afterPage = doc.bufferedPageRange().count;
        if (afterPage > beforePage) cardsOnPage = 1;
      }
    }
  }

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.font(PDF_FONT_NAME).fontSize(7).fillColor("#94a3b8").text(
      `Obsidian Prospect Engine | Page ${index + 1} of ${range.count}`,
      PDF_PAGE_MARGIN,
      doc.page.height - PDF_PAGE_MARGIN - 10,
      { width: pageWidth, align: "center", lineBreak: false, height: 10 }
    );
  }

  doc.end();
  return done;
}

export function exportContentType(format: LeadExportFormat): string {
  switch (format) {
    case "CSV":
      return "text/csv; charset=utf-8";
    case "XLSX":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "JSON":
      return "application/json; charset=utf-8";
    case "DOCX":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "PDF":
      return "application/pdf";
    default: {
      const exhaustive: never = format;
      throw new Error(`Unsupported export format: ${exhaustive}`);
    }
  }
}
