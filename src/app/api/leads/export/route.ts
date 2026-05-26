import { NextRequest, NextResponse } from "next/server";
import { ExportFormat } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  exportContentType,
  getExportLeads,
  parseExportColumns,
  renderCsv,
  renderDocx,
  renderPdf,
  renderXlsx,
} from "@/lib/export/leads-export";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") ?? "csv").toUpperCase() as ExportFormat;
    if (!["CSV", "XLSX", "PDF", "DOCX"].includes(format)) {
      return NextResponse.json({ error: "Unsupported export format" }, { status: 400 });
    }

    const columns = parseExportColumns(searchParams.get("columns"));
    const filters = {
      status: searchParams.get("status"),
      q: searchParams.get("q"),
      minScore: searchParams.get("minScore"),
      category: searchParams.get("category"),
      websiteStatus: searchParams.get("websiteStatus"),
    };
    const leads = await getExportLeads(filters);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = `obsidian-leads-${timestamp}.${format.toLowerCase()}`;

    const buffer =
      format === "CSV"
        ? renderCsv(leads, columns)
        : format === "XLSX"
          ? renderXlsx(leads, columns)
          : format === "DOCX"
            ? await renderDocx(leads, columns)
            : await renderPdf(leads, columns);

    await prisma.exportLog.create({
      data: {
        format,
        filename,
        filters,
        columnNames: columns,
        rowCount: leads.length,
      },
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": exportContentType(format),
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[leads export]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}
