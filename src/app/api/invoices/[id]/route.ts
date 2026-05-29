import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { invoiceVisibilityWhere } from "@/lib/auth/access";
import { createLeadActivity } from "@/lib/crm/activity";
import { getOperationalRecipientIds, notifyUsers } from "@/lib/notifications/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const existing = await prisma.invoice.findFirst({
      where: { id, ...invoiceVisibilityWhere(auth.session) },
    });
    if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const body = (await request.json()) as {
      status?: InvoiceStatus;
      invoiceUrl?: string | null;
      squareCustomerId?: string | null;
      squareInvoiceId?: string | null;
      paidAt?: string | null;
      notes?: string | null;
    };

    const invoice = await prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          ...(body.status && {
            status: body.status,
            sentAt: body.status === "SENT" ? existing.sentAt ?? new Date() : existing.sentAt,
            viewedAt: body.status === "VIEWED" ? existing.viewedAt ?? new Date() : existing.viewedAt,
            paidAt: body.status === "PAID"
              ? body.paidAt
                ? new Date(body.paidAt)
                : existing.paidAt ?? new Date()
              : existing.paidAt,
          }),
          ...(body.invoiceUrl !== undefined && { invoiceUrl: body.invoiceUrl || null }),
          ...(body.squareCustomerId !== undefined && {
            squareCustomerId: body.squareCustomerId || null,
          }),
          ...(body.squareInvoiceId !== undefined && {
            squareInvoiceId: body.squareInvoiceId || null,
          }),
          ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
        },
      });

      if (updated.status === "PAID" && updated.clientId) {
        const client = await tx.client.update({
          where: { id: updated.clientId },
          data: { status: "ACTIVE", paymentStatus: "PAID" },
        });
        const user = updated.ownerId
          ? await tx.user.findUnique({ where: { id: updated.ownerId } })
          : null;
        if (updated.ownerId && user) {
          const existingCommission = await tx.commission.findFirst({
            where: { invoiceId: updated.id },
          });
          if (!existingCommission) {
            const commission = await tx.commission.create({
              data: {
                userId: updated.ownerId,
                clientId: client.id,
                invoiceId: updated.id,
                saleAmount: updated.amountDue,
                commissionRate: user.commissionRate,
                commissionAmount:
                  Math.round(updated.amountDue * user.commissionRate * 100) / 100,
                status: "READY_TO_PAY",
                squarePaymentId: updated.squarePaymentId,
                notes: "Auto-created from paid invoice.",
              },
            });
            await createLeadActivity({
              tx,
              businessLeadId: updated.businessLeadId ?? client.businessLeadId,
              userId: updated.ownerId,
              type: "COMMISSION_CREATED",
              title: "Commission ready",
              body: `$${commission.commissionAmount.toLocaleString()} commission created from paid invoice.`,
              metadata: { commissionId: commission.id, invoiceId: updated.id, clientId: client.id },
            });
          }
        }

        await createLeadActivity({
          tx,
          businessLeadId: updated.businessLeadId ?? client.businessLeadId,
          userId: auth.session.userId,
          type: "PAYMENT_RECEIVED",
          title: "Invoice marked paid",
          body: `$${updated.amountDue.toLocaleString()} invoice marked paid.`,
          metadata: { invoiceId: updated.id, clientId: client.id },
        });

        const recipients = await getOperationalRecipientIds({
          tx,
          ownerId: client.ownerId,
          closerId: client.closedById,
        });
        await notifyUsers({
          tx,
          userIds: recipients,
          type: "PAYMENT_SUCCEEDED",
          title: `Invoice paid: ${client.businessName}`,
          body: `$${updated.amountDue.toLocaleString()} website build invoice was marked paid.`,
          metadata: { invoiceId: updated.id, clientId: client.id },
        });
      }

      return updated;
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("[invoices PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invoice update failed" },
      { status: 500 }
    );
  }
}
