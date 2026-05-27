import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { isSessionSuperAdmin, leadVisibilityWhere } from "@/lib/auth/access";
import { discoverLeadEmails } from "@/lib/leads/email-discovery";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const lead = await prisma.businessLead.findFirst({
      where: { id, ...leadVisibilityWhere(auth.session) },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (!isSessionSuperAdmin(auth.session) && lead.ownerId !== auth.session.userId) {
      return NextResponse.json(
        { error: "Only the lead owner can run email discovery." },
        { status: 403 }
      );
    }

    const result = await discoverLeadEmails(id);
    await prisma.leadActivity.create({
      data: {
        businessLeadId: id,
        userId: auth.session.userId,
        type: "LEAD_UPDATED",
        title: "Email discovery completed",
        body:
          result.emails.length > 0
            ? `Found ${result.emails.length} email contact(s).`
            : "No public email contact found.",
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[discover-email]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Email discovery failed" },
      { status: 500 }
    );
  }
}
