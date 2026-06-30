import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import {
  exportContentType,
  getExportLeads,
  LeadExportFormat,
  parseExportColumns,
  renderCsv,
  renderDocx,
  renderJson,
  renderPdf,
  renderXlsx,
} from "@/lib/export/leads-export";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") ?? "csv").toUpperCase() as LeadExportFormat;
    if (!["CSV", "XLSX", "JSON", "PDF", "DOCX"].includes(format)) {
      return NextResponse.json({ error: "Unsupported export format" }, { status: 400 });
    }

    const columns = parseExportColumns(searchParams.get("columns"));
    const filters = {
      status: searchParams.get("status"),
      q: searchParams.get("q"),
      minScore: searchParams.get("minScore"),
      category: searchParams.get("category"),
      websiteStatus: searchParams.get("websiteStatus"),
      ownership: searchParams.get("ownership"),
      city: searchParams.get("city"),
      state: searchParams.get("state"),
      sort: searchParams.get("sort"),
      direction: searchParams.get("direction"),
    };
    const leads = await getExportLeads(filters, auth.session);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = `obsidian-saved-leads-${timestamp}.${format.toLowerCase()}`;

    const buffer =
      format === "CSV"
        ? renderCsv(leads, columns)
        : format === "XLSX"
          ? renderXlsx(leads, columns)
          : format === "JSON"
            ? renderJson(leads)
            : format === "DOCX"
              ? await renderDocx(leads, columns)
              : await renderPdf(leads, columns);

    if (format !== "JSON") {
      await prisma.exportLog.create({
        data: {
          format,
          userId: auth.session.userId,
          filename,
          filters,
          columnNames: columns,
          rowCount: leads.length,
        },
      });
    }

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
