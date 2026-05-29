import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { invoiceVisibilityWhere } from "@/lib/auth/access";
import { createAndPublishSquareInvoice, getSquareAvailability } from "@/lib/invoices/square";
import { createLeadActivity } from "@/lib/crm/activity";
import { getOperationalRecipientIds, notifyUsers } from "@/lib/notifications/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, ...invoiceVisibilityWhere(auth.session) },
      include: { client: true, businessLead: true },
    });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (!invoice.client) {
      return NextResponse.json({ error: "Invoice must be linked to a client before Square sending." }, { status: 400 });
    }

    const availability = getSquareAvailability();
    if (!availability.available) {
      return NextResponse.json({ unavailable: true, reason: availability.reason });
    }

    const result = await createAndPublishSquareInvoice({ invoice, client: invoice.client });
    if (!("squareInvoiceId" in result)) {
      return NextResponse.json(result);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          dueDate: result.dueDate,
          squareCustomerId: result.squareCustomerId,
          squareOrderId: result.squareOrderId,
          squareInvoiceId: result.squareInvoiceId,
          invoiceUrl: result.invoiceUrl,
        },
      });

      const updatedClient = await tx.client.update({
        where: { id: invoice.client!.id },
        data: {
          squareCustomerId: result.squareCustomerId,
          latestSquareInvoiceId: result.squareInvoiceId,
        },
      });

      await createLeadActivity({
        tx,
        businessLeadId: invoice.businessLeadId ?? invoice.client!.businessLeadId,
        userId: auth.session.userId,
        type: "INVOICE_SENT",
        title: "Square invoice sent",
        body: `$${invoice.amountDue.toLocaleString()} invoice sent through Square.`,
        metadata: { invoiceId: invoice.id, clientId: updatedClient.id, squareInvoiceId: result.squareInvoiceId },
      });

      const recipients = await getOperationalRecipientIds({
        tx,
        ownerId: updatedClient.ownerId,
        closerId: updatedClient.closedById,
      });
      await notifyUsers({
        tx,
        userIds: recipients,
        type: "INVOICE_SENT",
        title: `Invoice sent: ${updatedClient.businessName}`,
        body: `$${invoice.amountDue.toLocaleString()} invoice sent through Square.`,
        metadata: { invoiceId: invoice.id, clientId: updatedClient.id, squareInvoiceId: result.squareInvoiceId },
      });

      return updatedInvoice;
    });

    return NextResponse.json({ ...result, unavailable: false, invoice: updated });
  } catch (error) {
    console.error("[square invoice]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Square invoice failed" },
      { status: 500 }
    );
  }
}
