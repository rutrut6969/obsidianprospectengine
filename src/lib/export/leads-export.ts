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
import { ExportFormat, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SessionPayload } from "@/lib/auth/session";
import { leadVisibilityWhere } from "@/lib/auth/access";

export const EXPORT_COLUMNS = [
  "name",
  "category",
  "address",
  "city",
  "state",
  "phone",
  "websiteUrl",
  "websiteStatus",
  "leadScore",
  "rating",
  "reviewCount",
  "notes",
  "status",
] as const;

type ExportColumn = (typeof EXPORT_COLUMNS)[number];

const HEADERS: Record<ExportColumn, string> = {
  name: "Business Name",
  category: "Category",
  address: "Address",
  city: "City",
  state: "State",
  phone: "Phone",
  websiteUrl: "Website",
  websiteStatus: "Website Status",
  leadScore: "Lead Score",
  rating: "Rating",
  reviewCount: "Reviews",
  notes: "Notes",
  status: "Contact Status",
};

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
}, session?: SessionPayload) {
  const where: Prisma.BusinessLeadWhereInput = {
    deletedAt: null,
    ...(session ? leadVisibilityWhere(session) : {}),
  };
  if (filters.status) where.status = filters.status as never;
  if (filters.category) where.category = { equals: filters.category, mode: "insensitive" };
  if (filters.websiteStatus) where.websiteStatus = filters.websiteStatus as never;
  if (filters.minScore) where.leadScore = { gte: Number(filters.minScore) };
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { category: { contains: filters.q, mode: "insensitive" } },
      { city: { contains: filters.q, mode: "insensitive" } },
      { state: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  return prisma.businessLead.findMany({
    where,
    orderBy: [{ leadScore: "desc" }, { updatedAt: "desc" }],
    take: 1000,
  });
}

function valueFor(row: Awaited<ReturnType<typeof getExportLeads>>[number], column: ExportColumn) {
  const value = row[column];
  if (value == null) return "";
  return String(value);
}

function tableRows(
  leads: Awaited<ReturnType<typeof getExportLeads>>,
  columns: ExportColumn[]
) {
  return leads.map((lead) => {
    const row: Record<string, string> = {};
    for (const column of columns) row[HEADERS[column]] = valueFor(lead, column);
    return row;
  });
}

export function renderCsv(
  leads: Awaited<ReturnType<typeof getExportLeads>>,
  columns: ExportColumn[]
): Buffer {
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

export function renderXlsx(
  leads: Awaited<ReturnType<typeof getExportLeads>>,
  columns: ExportColumn[]
): Buffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(tableRows(leads, columns));
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function renderDocx(
  leads: Awaited<ReturnType<typeof getExportLeads>>,
  columns: ExportColumn[]
): Promise<Buffer> {
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
            children: [new TextRun({ text: "Obsidian Prospect Engine Lead Export", bold: true, size: 28 })],
          }),
          new Paragraph(`Generated ${new Date().toLocaleString()} with ${leads.length} leads.`),
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

export async function renderPdf(
  leads: Awaited<ReturnType<typeof getExportLeads>>,
  columns: ExportColumn[]
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 36, size: "LETTER", layout: "landscape" });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fillColor("#111827").fontSize(18).text("Obsidian Prospect Engine Lead Export");
  doc.fillColor("#475569").fontSize(9).text(`Generated ${new Date().toLocaleString()} · ${leads.length} leads`);
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
  }
}
