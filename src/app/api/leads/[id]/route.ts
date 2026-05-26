import { NextRequest, NextResponse } from "next/server";
import { LeadStatus, WebsiteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const lead = await prisma.businessLead.findUnique({
      where: { id },
      include: {
        websiteAudits: { orderBy: { createdAt: "desc" } },
        outreachDrafts: { orderBy: { updatedAt: "desc" } },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ lead });
  } catch (error) {
    console.error("[leads GET id]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch lead" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status, notes, leadScore, websiteStatus, websiteUrl } = body as {
      status?: LeadStatus;
      notes?: string;
      leadScore?: number;
      websiteStatus?: string;
      websiteUrl?: string;
    };

    const lead = await prisma.businessLead.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(leadScore !== undefined && { leadScore }),
        ...(websiteStatus && { websiteStatus: websiteStatus as WebsiteStatus }),
        ...(websiteUrl !== undefined && { websiteUrl }),
      },
    });

    return NextResponse.json({ lead });
  } catch (error) {
    console.error("[leads PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
