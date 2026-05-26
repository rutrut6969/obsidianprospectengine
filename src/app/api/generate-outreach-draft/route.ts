import { NextRequest, NextResponse } from "next/server";
import { WebsiteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateOutreachDraft } from "@/lib/outreach";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      businessLeadId,
      businessName,
      websiteStatus,
      channel = "EMAIL",
      save = true,
      senderName,
      companyName,
    } = body as {
      businessLeadId?: string;
      businessName?: string;
      websiteStatus?: WebsiteStatus;
      channel?: "EMAIL" | "SMS" | "FACEBOOK" | "PHONE";
      save?: boolean;
      senderName?: string;
      companyName?: string;
    };

    let name = businessName;
    let status = websiteStatus ?? "UNKNOWN";

    if (businessLeadId) {
      const lead = await prisma.businessLead.findUnique({
        where: { id: businessLeadId },
      });
      if (!lead) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
      name = lead.name;
      status = lead.websiteStatus;
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "businessName or businessLeadId required" },
        { status: 400 }
      );
    }

    const { subject, message } = generateOutreachDraft({
      businessName: name,
      websiteStatus: status,
      senderName,
      companyName,
    });

    if (save && businessLeadId) {
      const draft = await prisma.outreachDraft.create({
        data: {
          businessLeadId,
          subject,
          message,
          channel,
          status: "DRAFT",
        },
      });
      return NextResponse.json({ subject, message, draft });
    }

    return NextResponse.json({ subject, message });
  } catch (error) {
    console.error("[generate-outreach-draft]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
