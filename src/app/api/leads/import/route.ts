import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import {
  importSavedLeads,
  parseImportedLeadFileFromBuffer,
  validateImportFile,
} from "@/lib/import/leads-import";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a CSV, XLSX, XLS, or JSON file." }, { status: 400 });
    }

    validateImportFile(file.name, file.size);
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseImportedLeadFileFromBuffer(buffer, file.name);
    const summary = await importSavedLeads(parsed.leads, auth.session, parsed);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("[leads import]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 400 }
    );
  }
}
