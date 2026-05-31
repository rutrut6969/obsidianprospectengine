import { NextRequest, NextResponse } from "next/server";
import { LeadStatus, WebsiteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { restoreLead, softDeleteLead } from "@/lib/leads/service";
import { requireSession } from "@/lib/auth/guards";
import { isSessionSuperAdmin, leadVisibilityWhere } from "@/lib/auth/access";

type RouteContext = { params: Promise<{ id: string }> };

function ownershipMeta(
  lead: {
    ownerId: string | null;
    visibility: "GLOBAL" | "PRIVATE";
    owner?: { role: string } | null;
  },
  session: { userId: string; role: string }
) {
  return {
    ownershipKind:
      lead.ownerId === session.userId
        ? "MY_LEAD"
        : lead.visibility === "GLOBAL"
          ? "GLOBAL"
          : "PRIVATE",
    isMine: lead.ownerId === session.userId,
    isGlobal: lead.visibility === "GLOBAL",
    isAdminLead:
      lead.visibility === "GLOBAL" && !lead.ownerId ? true : lead.owner?.role === "SUPER_ADMIN",
    canManage: session.role === "SUPER_ADMIN" || lead.ownerId === session.userId,
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const lead = await prisma.businessLead.findFirst({
      where: { id, ...leadVisibilityWhere(auth.session) },
      include: {
        websiteAudits: { orderBy: { createdAt: "desc" } },
        owner: { select: { id: true, fullName: true, email: true, role: true } },
        outreachDrafts: {
          orderBy: { updatedAt: "desc" },
          include: { logs: { orderBy: { createdAt: "desc" }, take: 3 } },
        },
        activities: { orderBy: { createdAt: "desc" }, take: 25 },
        contactMethods: { orderBy: [{ isPrimary: "desc" }, { confidence: "desc" }] },
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
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const existing = await prisma.businessLead.findFirst({
      where: { id, ...leadVisibilityWhere(auth.session) },
    });
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (!isSessionSuperAdmin(auth.session) && existing.ownerId !== auth.session.userId) {
      return NextResponse.json(
        { error: "Only the lead owner can update this lead." },
        { status: 403 }
      );
    }

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
      const lead = await restoreLead(id, auth.session);
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
          userId: auth.session.userId,
          type: status ? "STATUS_CHANGE" : "LEAD_UPDATED",
          title: status ? `Status changed to ${status.replace(/_/g, " ")}` : "Lead updated",
          body: notes !== undefined ? "Notes were updated." : null,
        },
      });

      return updated;
    });

    return NextResponse.json({
      lead: { ...lead, ...ownershipMeta(lead, auth.session) },
    });
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
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const existing = await prisma.businessLead.findFirst({
      where: { id, ...leadVisibilityWhere(auth.session) },
    });
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (!isSessionSuperAdmin(auth.session) && existing.ownerId !== auth.session.userId) {
      return NextResponse.json(
        { error: "Only the lead owner can delete this lead." },
        { status: 403 }
      );
    }
    const lead = await softDeleteLead(id, auth.session);
    return NextResponse.json({ lead: { ...lead, ...ownershipMeta(lead, auth.session) } });
  } catch (error) {
    console.error("[leads DELETE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
