import { NextRequest, NextResponse } from "next/server";
import { OutreachStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTwilioAvailability } from "@/lib/outreach/twilio";
import { getOutreachTestOverride, getOutreachTestOverrideWarning } from "@/lib/outreach/email-config";
import { requireSession } from "@/lib/auth/guards";
import { isSessionSuperAdmin, leadVisibilityWhere } from "@/lib/auth/access";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as OutreachStatus | null;

    const drafts = await prisma.outreachDraft.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(!isSessionSuperAdmin(auth.session) ? { ownerId: auth.session.userId } : {}),
        businessLead: { deletedAt: null, ...leadVisibilityWhere(auth.session) },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        businessLead: {
          include: { websiteAudits: { orderBy: { createdAt: "desc" }, take: 1 } },
        },
        logs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      take: 100,
    });

    return NextResponse.json({
      drafts,
      capabilities: {
        resend: Boolean(process.env.RESEND_API_KEY),
        email: {
          resendConfigured: Boolean(process.env.RESEND_API_KEY),
          testOverrideActive: Boolean(getOutreachTestOverride()),
          warning: getOutreachTestOverrideWarning(),
        },
        twilio: getTwilioAvailability(),
        openai: Boolean(process.env.OPENAI_API_KEY),
      },
    });
  } catch (error) {
    console.error("[outreach-drafts GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load drafts" },
      { status: 500 }
    );
  }
}
