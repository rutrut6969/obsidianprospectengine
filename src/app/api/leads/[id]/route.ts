import { NextRequest, NextResponse } from "next/server";
import { LeadStatus, WebsiteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { restoreLead, softDeleteLead } from "@/lib/leads/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const lead = await prisma.businessLead.findUnique({
      where: { id },
      include: {
        websiteAudits: { orderBy: { createdAt: "desc" } },
        outreachDrafts: {
          orderBy: { updatedAt: "desc" },
          include: { logs: { orderBy: { createdAt: "desc" }, take: 3 } },
        },
        activities: { orderBy: { createdAt: "desc" }, take: 25 },
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
      restore?: boolean;
    };

    if (body.restore === true) {
      const lead = await restoreLead(id);
      return NextResponse.json({ lead });
    }

    const lead = await prisma.$transaction(async (tx) => {
      const updated = await tx.businessLead.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...(notes !== undefined && { notes }),
          ...(leadScore !== undefined && { leadScore: Number(leadScore) }),
          ...(websiteStatus && { websiteStatus: websiteStatus as WebsiteStatus }),
          ...(websiteUrl !== undefined && { websiteUrl }),
        },
      });

      await tx.leadActivity.create({
        data: {
          businessLeadId: id,
          type: status ? "STATUS_CHANGE" : "LEAD_UPDATED",
          title: status ? `Status changed to ${status.replace(/_/g, " ")}` : "Lead updated",
          body: notes !== undefined ? "Notes were updated." : null,
        },
      });

      return updated;
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

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const lead = await softDeleteLead(id);
    return NextResponse.json({ lead });
  } catch (error) {
    console.error("[leads DELETE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
