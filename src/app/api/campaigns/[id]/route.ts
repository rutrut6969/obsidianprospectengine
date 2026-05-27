import { NextRequest, NextResponse } from "next/server";
import { CampaignStatus, CampaignType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { isSessionSuperAdmin } from "@/lib/auth/access";

type RouteContext = { params: Promise<{ id: string }> };

async function getAccessibleCampaign(id: string, userId: string, isAdmin: boolean) {
  return prisma.campaign.findFirst({
    where: { id, deletedAt: null, ...(isAdmin ? {} : { ownerId: userId }) },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const isAdmin = isSessionSuperAdmin(auth.session);
    const campaign = await getAccessibleCampaign(id, auth.session.userId, isAdmin);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    const body = (await request.json()) as {
      name?: string;
      type?: CampaignType;
      status?: CampaignStatus;
      templateId?: string | null;
      notes?: string | null;
      leadIds?: string[];
    };

    const updated = await prisma.$transaction(async (tx) => {
      if (body.leadIds) {
        await tx.campaignLead.deleteMany({ where: { campaignId: id } });
        const visibleLeads = await tx.businessLead.findMany({
          where: {
            id: { in: body.leadIds },
            deletedAt: null,
            ...(isAdmin
              ? {}
              : { OR: [{ ownerId: auth.session.userId }, { visibility: "GLOBAL" }] }),
          },
          select: { id: true },
        });
        await tx.campaignLead.createMany({
          data: visibleLeads.map((lead) => ({ campaignId: id, businessLeadId: lead.id })),
          skipDuplicates: true,
        });
      }

      return tx.campaign.update({
        where: { id },
        data: {
          ...(body.name?.trim() && { name: body.name.trim() }),
          ...(body.type && { type: body.type }),
          ...(body.status && {
            status: body.status,
            pausedAt: body.status === "PAUSED" ? new Date() : null,
          }),
          ...(body.templateId !== undefined && { templateId: body.templateId || null }),
          ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
        },
        include: { _count: { select: { leads: true } } },
      });
    });

    return NextResponse.json({ campaign: updated });
  } catch (error) {
    console.error("[campaigns PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Campaign update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const campaign = await getAccessibleCampaign(
      id,
      auth.session.userId,
      isSessionSuperAdmin(auth.session)
    );
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    const deleted = await prisma.campaign.update({
      where: { id },
      data: { deletedAt: new Date(), status: "PAUSED" },
    });

    return NextResponse.json({ campaign: deleted });
  } catch (error) {
    console.error("[campaigns DELETE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Campaign delete failed" },
      { status: 500 }
    );
  }
}
