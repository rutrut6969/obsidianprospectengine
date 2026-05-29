import { NextRequest, NextResponse } from "next/server";
import { CommissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { isSessionSuperAdmin } from "@/lib/auth/access";
import { getOperationalRecipientIds, notifyUsers } from "@/lib/notifications/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  if (!isSessionSuperAdmin(auth.session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      commissionAmount?: number;
      status?: CommissionStatus;
      payoutDate?: string | null;
      notes?: string | null;
      payoutProvider?: string | null;
      externalPayoutId?: string | null;
      payoutFailureReason?: string | null;
    };

    const commission = await prisma.$transaction(async (tx) => {
      const current = await tx.commission.findUnique({
        where: { id },
        include: { client: true },
      });
      if (!current) throw new Error("Commission not found");

      const updated = await tx.commission.update({
        where: { id },
        data: {
          ...(body.commissionAmount !== undefined && {
            commissionAmount: Number(body.commissionAmount),
          }),
          ...(body.status && {
            status: body.status,
            payoutApprovedById:
              body.status === "APPROVED" ? auth.session.userId : current.payoutApprovedById,
            payoutApprovedAt:
              body.status === "APPROVED" ? current.payoutApprovedAt ?? new Date() : current.payoutApprovedAt,
            payoutProcessedAt:
              body.status === "PAID" ? current.payoutProcessedAt ?? new Date() : current.payoutProcessedAt,
          }),
          ...(body.payoutDate !== undefined && {
            payoutDate: body.payoutDate ? new Date(body.payoutDate) : null,
          }),
          ...(body.payoutProvider !== undefined && {
            payoutProvider: body.payoutProvider?.trim() || null,
          }),
          ...(body.externalPayoutId !== undefined && {
            externalPayoutId: body.externalPayoutId?.trim() || null,
          }),
          ...(body.payoutFailureReason !== undefined && {
            payoutFailureReason: body.payoutFailureReason?.trim() || null,
          }),
          ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
        },
      });

      if (body.status === "APPROVED" || body.status === "PAID") {
        const recipients = await getOperationalRecipientIds({
          tx,
          ownerId: current.userId,
          closerId: current.client?.closedById,
        });
        await notifyUsers({
          tx,
          userIds: recipients,
          type: body.status === "APPROVED" ? "PAYOUT_APPROVED" : "PAYOUT_PAID",
          title:
            body.status === "APPROVED"
              ? "Commission payout approved"
              : "Commission payout marked paid",
          body: `$${updated.commissionAmount.toLocaleString()} commission for ${current.client?.businessName ?? "client"}.`,
          metadata: { commissionId: updated.id, clientId: updated.clientId },
        });
      }

      return updated;
    });

    return NextResponse.json({ commission });
  } catch (error) {
    console.error("[commissions PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Commission update failed" },
      { status: 500 }
    );
  }
}
