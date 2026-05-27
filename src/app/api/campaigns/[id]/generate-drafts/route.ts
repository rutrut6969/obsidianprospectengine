import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { isSessionSuperAdmin } from "@/lib/auth/access";
import { generateOutreachDraft, selectChannelMessage } from "@/lib/outreach";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(isSessionSuperAdmin(auth.session) ? {} : { ownerId: auth.session.userId }),
      },
      include: {
        leads: {
          include: {
            businessLead: {
              include: { websiteAudits: { orderBy: { createdAt: "desc" }, take: 1 } },
            },
          },
        },
      },
    });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    let created = 0;
    for (const campaignLead of campaign.leads) {
      const lead = campaignLead.businessLead;
      const latestAudit = lead.websiteAudits[0];
      const generated = await generateOutreachDraft({
        businessName: lead.name,
        websiteStatus: lead.websiteStatus,
        category: lead.category,
        city: lead.city,
        state: lead.state,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
        websiteUrl: lead.websiteUrl,
        auditSummary: latestAudit?.summary,
        auditWeaknesses: latestAudit?.weaknesses,
        channel: campaign.type,
      });
      await prisma.outreachDraft.create({
        data: {
          businessLeadId: lead.id,
          ownerId: auth.session.userId,
          templateId: campaign.templateId,
          channel: campaign.type,
          subject: generated.subject,
          message: selectChannelMessage(generated, campaign.type),
          status: "DRAFT",
          aiProvider: generated.aiProvider,
          aiReasoning: generated.aiReasoning,
          aiScore: generated.aiScore,
          websiteAuditSummary: generated.websiteAuditSummary,
        },
      });
      created += 1;
    }

    return NextResponse.json({ created });
  } catch (error) {
    console.error("[campaign generate drafts]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Campaign draft generation failed" },
      { status: 500 }
    );
  }
}
