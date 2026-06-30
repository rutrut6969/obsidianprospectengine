import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
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

export async function renderPdf(leads: ExportLead[], columns: ExportColumn[]): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 36, size: "LETTER", layout: "landscape" });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fillColor("#111827").fontSize(18).text("Obsidian Prospect Engine Saved Leads Export");
  doc.fillColor("#475569").fontSize(9).text(`Generated ${new Date().toLocaleString()} | ${leads.length} saved leads`);
  doc.moveDown();

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = pageWidth / columns.length;
  doc.fontSize(7).fillColor("#0f172a");
  columns.forEach((column, index) => {
    doc.text(HEADERS[column], doc.page.margins.left + index * columnWidth, doc.y, {
      width: columnWidth - 4,
      continued: index !== columns.length - 1,
    });
  });
  doc.text("");
  doc.moveDown(0.5);

  for (const lead of leads) {
    const y = doc.y;
    if (y > doc.page.height - 56) doc.addPage();
    columns.forEach((column, index) => {
      doc.fillColor("#334155").text(valueFor(lead, column), doc.page.margins.left + index * columnWidth, y, {
        width: columnWidth - 4,
        height: 28,
      });
    });
    doc.moveDown(2);
  }

  doc.end();
  return done;
}

export function exportContentType(format: ExportFormat): string {
  switch (format) {
    case "CSV":
      return "text/csv; charset=utf-8";
    case "XLSX":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
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
