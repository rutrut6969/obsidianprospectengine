import { NextRequest, NextResponse } from "next/server";
import { OutreachStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendApprovedEmailDraft } from "@/lib/outreach/resend-send";
import { sendApprovedSmsDraft } from "@/lib/outreach/twilio";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      subject?: string | null;
      message?: string;
      status?: OutreachStatus;
      action?: "approve" | "reject" | "send";
    };

    if (body.action === "send") {
      const draft = await prisma.outreachDraft.findUnique({ where: { id } });
      if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
      const result =
        draft.channel === "SMS"
          ? await sendApprovedSmsDraft(id)
          : draft.channel === "EMAIL"
            ? await sendApprovedEmailDraft(id)
            : null;
      if (!result) {
        return NextResponse.json(
          { error: `${draft.channel} sending is not implemented yet` },
          { status: 400 }
        );
      }
      return NextResponse.json({ result });
    }

    const now = new Date();
    const status =
      body.action === "approve"
        ? "APPROVED"
        : body.action === "reject"
          ? "REJECTED"
          : body.status;

    const draft = await prisma.$transaction(async (tx) => {
      const updated = await tx.outreachDraft.update({
        where: { id },
        data: {
          ...(body.subject !== undefined && { subject: body.subject }),
          ...(body.message !== undefined && { message: body.message }),
          ...(status && { status }),
          ...(status === "APPROVED" && { approvedAt: now, rejectedAt: null }),
          ...(status === "REJECTED" && { rejectedAt: now }),
        },
      });

      if (status === "APPROVED" || status === "REJECTED") {
        await tx.leadActivity.create({
          data: {
            businessLeadId: updated.businessLeadId,
            type: status === "APPROVED" ? "OUTREACH_APPROVED" : "OUTREACH_REJECTED",
            title:
              status === "APPROVED"
                ? `${updated.channel} draft approved`
                : `${updated.channel} draft rejected`,
          },
        });
      }

      return updated;
    });

    return NextResponse.json({ draft });
  } catch (error) {
    console.error("[outreach-drafts PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draft update failed" },
      { status: 500 }
    );
  }
}
