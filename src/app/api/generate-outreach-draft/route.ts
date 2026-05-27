import { NextRequest, NextResponse } from "next/server";
import { OutreachChannel, Prisma, WebsiteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateOutreachDraft, selectChannelMessage } from "@/lib/outreach";
import { requireSession } from "@/lib/auth/guards";
import { leadVisibilityWhere } from "@/lib/auth/access";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

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
    let leadContext: Prisma.BusinessLeadGetPayload<{
      include: { websiteAudits: { orderBy: { createdAt: "desc" }; take: 1 } };
    }> | null = null;

    if (businessLeadId) {
      const lead = await prisma.businessLead.findUnique({
        where: { id: businessLeadId },
        include: { websiteAudits: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      const visibleLead = lead
        ? await prisma.businessLead.findFirst({
            where: { id: businessLeadId, ...leadVisibilityWhere(auth.session) },
            select: { id: true },
          })
        : null;
      if (!lead || !visibleLead) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
      leadContext = lead;
      name = lead.name;
      status = lead.websiteStatus;
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "businessName or businessLeadId required" },
        { status: 400 }
      );
    }

    const generated = await generateOutreachDraft({
      businessName: name,
      websiteStatus: status,
      category: leadContext?.category,
      city: leadContext?.city,
      state: leadContext?.state,
      rating: leadContext?.rating,
      reviewCount: leadContext?.reviewCount,
      websiteUrl: leadContext?.websiteUrl,
      auditSummary: leadContext?.websiteAudits[0]?.summary,
      auditWeaknesses: leadContext?.websiteAudits[0]?.weaknesses,
      channel: channel as OutreachChannel,
      senderName,
      companyName,
    });
    const message = selectChannelMessage(generated, channel as OutreachChannel);

    if (save && businessLeadId) {
      const draft = await prisma.$transaction(async (tx) => {
        const created = await tx.outreachDraft.create({
          data: {
            businessLeadId,
            ownerId: auth.session.userId,
            subject: generated.subject,
            message,
            channel,
            status: "DRAFT",
            aiProvider: generated.aiProvider,
            aiReasoning: generated.aiReasoning,
            aiScore: generated.aiScore,
            websiteAuditSummary: generated.websiteAuditSummary,
          },
        });
        await tx.leadActivity.create({
          data: {
            businessLeadId,
            userId: auth.session.userId,
            type: "OUTREACH_GENERATED",
            title: `${channel} outreach draft generated`,
            body:
              generated.aiProvider === "openai"
                ? "Generated with optional OpenAI integration."
                : "Generated with fallback template rules.",
          },
        });
        return created;
      });
      return NextResponse.json({ subject: generated.subject, message, draft });
    }

    return NextResponse.json({ subject: generated.subject, message });
  } catch (error) {
    console.error("[generate-outreach-draft]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
