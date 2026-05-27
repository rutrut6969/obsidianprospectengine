import { NextRequest, NextResponse } from "next/server";
import { CampaignType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { isSessionSuperAdmin } from "@/lib/auth/access";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const campaigns = await prisma.campaign.findMany({
    where: {
      deletedAt: null,
      ...(!isSessionSuperAdmin(auth.session) ? { ownerId: auth.session.userId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { id: true, fullName: true, email: true } },
      template: { select: { id: true, name: true, type: true } },
      _count: { select: { leads: true } },
    },
  });

  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      name?: string;
      type?: CampaignType;
      templateId?: string | null;
      businessCategory?: string | null;
      city?: string | null;
      state?: string | null;
      notes?: string | null;
      leadIds?: string[];
      scheduledAt?: string | null;
      sendWindowStart?: string | null;
      sendWindowEnd?: string | null;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Campaign name is required." }, { status: 400 });
    }

    const visibleLeadIds =
      body.leadIds && body.leadIds.length > 0
        ? await prisma.businessLead.findMany({
            where: {
              id: { in: body.leadIds },
              deletedAt: null,
              ...(isSessionSuperAdmin(auth.session)
                ? {}
                : { OR: [{ ownerId: auth.session.userId }, { visibility: "GLOBAL" }] }),
            },
            select: { id: true },
          })
        : [];

    const campaign = await prisma.campaign.create({
      data: {
        ownerId: auth.session.userId,
        name: body.name.trim(),
        type: body.type ?? "EMAIL",
        templateId: body.templateId || null,
        businessCategory: body.businessCategory?.trim() || null,
        city: body.city?.trim() || null,
        state: body.state?.trim()?.toUpperCase() || null,
        notes: body.notes?.trim() || null,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        sendWindowStart: body.sendWindowStart || null,
        sendWindowEnd: body.sendWindowEnd || null,
        status: "DRAFT",
        leads: {
          create: visibleLeadIds.map((lead) => ({ businessLeadId: lead.id })),
        },
      },
      include: { _count: { select: { leads: true } } },
    });

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("[campaigns POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Campaign create failed" },
      { status: 500 }
    );
  }
}
