import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { isSessionSuperAdmin } from "@/lib/auth/access";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const existing = await prisma.invoice.findFirst({
      where: { id, ...(isSessionSuperAdmin(auth.session) ? {} : { ownerId: auth.session.userId }) },
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
          await tx.commission.create({
            data: {
              userId: updated.ownerId,
              clientId: client.id,
              invoiceId: updated.id,
              saleAmount: updated.amountDue,
              commissionRate: user.commissionRate,
              commissionAmount:
                Math.round(updated.amountDue * user.commissionRate * 100) / 100,
              status: "PENDING",
              notes: "Auto-created from paid invoice.",
            },
          });
        }
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
