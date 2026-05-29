import { NextRequest, NextResponse } from "next/server";
import { RetainerTier } from "@prisma/client";
import { requireSession } from "@/lib/auth/guards";
import { clientVisibilityWhere } from "@/lib/auth/access";
import { prisma } from "@/lib/prisma";
import {
  createAndPublishSquareInvoice,
  createSquareSubscription,
  getSquareAvailability,
} from "@/lib/invoices/square";
import { createLeadActivity } from "@/lib/crm/activity";
import { getOperationalRecipientIds, notifyUsers } from "@/lib/notifications/service";

type RouteContext = { params: Promise<{ id: string }> };

function retainerAmountForTier(tier: RetainerTier, customAmount?: number) {
  if (tier === "PROMO_100") return 100;
  if (tier === "STANDARD_200") return 200;
  if (tier === "CUSTOM") return Math.max(0, Number(customAmount ?? 0));
  return 0;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      websiteBuildAmount?: number;
      retainerTier?: RetainerTier;
      customRetainerAmount?: number;
      dueDate?: string | null;
      retainerStartDate?: string | null;
      sendInvoice?: boolean;
      setupRetainer?: boolean;
    };

    const websiteBuildAmount = Number(body.websiteBuildAmount ?? 0);
    if (websiteBuildAmount <= 0) {
      return NextResponse.json({ error: "Website build amount must be greater than zero." }, { status: 400 });
    }

    const tier = body.retainerTier ?? "PROMO_100";
    const retainerAmount = retainerAmountForTier(tier, body.customRetainerAmount);
    const client = await prisma.client.findFirst({
      where: { id, ...clientVisibilityWhere(auth.session) },
    });

    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const dueDate = body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    const retainerStartDate = body.retainerStartDate ? new Date(body.retainerStartDate) : new Date();
    const availability = getSquareAvailability();

    const result = await prisma.$transaction(async (tx) => {
      const updatedClient = await tx.client.update({
        where: { id: client.id },
        data: {
          upfrontWebsitePrice: websiteBuildAmount,
          retainerTier: tier,
          retainerAmount,
          retainerBillingCycle: "MONTHLY",
          retainerStartDate,
          nextPaymentDate: retainerAmount > 0 ? retainerStartDate : client.nextPaymentDate,
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          ownerId: auth.session.userId,
          businessLeadId: client.businessLeadId,
          clientId: client.id,
          title: `Website build for ${client.businessName}`,
          description: "Upfront website build invoice generated from client billing setup.",
          amountDue: websiteBuildAmount,
          retainerAmount,
          dueDate,
          status: "DRAFT",
        },
      });

      await createLeadActivity({
        tx,
        businessLeadId: client.businessLeadId,
        userId: auth.session.userId,
        type: "INVOICE_SENT",
        title: "Website build invoice drafted",
        body: `$${websiteBuildAmount.toLocaleString()} website build invoice created.`,
        metadata: { clientId: client.id, invoiceId: invoice.id },
      });

      return { updatedClient, invoice };
    });

    let invoiceResult:
      | Awaited<ReturnType<typeof createAndPublishSquareInvoice>>
      | { unavailable: true; reason: string | null } = {
      unavailable: true,
      reason: availability.reason,
    };

    if (body.sendInvoice !== false && availability.available) {
      try {
        invoiceResult = await createAndPublishSquareInvoice({
          invoice: result.invoice,
          client: result.updatedClient,
        });
      } catch (error) {
        invoiceResult = {
          unavailable: true,
          reason: error instanceof Error ? error.message : "Square invoice send failed.",
        };
      }
    }

    let invoice = result.invoice;
    let clientAfterBilling = result.updatedClient;

    if ("squareInvoiceId" in invoiceResult) {
      invoice = await prisma.invoice.update({
        where: { id: result.invoice.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          dueDate: invoiceResult.dueDate,
          squareCustomerId: invoiceResult.squareCustomerId,
          squareOrderId: invoiceResult.squareOrderId,
          squareInvoiceId: invoiceResult.squareInvoiceId,
          invoiceUrl: invoiceResult.invoiceUrl,
        },
      });
      clientAfterBilling = await prisma.client.update({
        where: { id: client.id },
        data: {
          squareCustomerId: invoiceResult.squareCustomerId,
          latestSquareInvoiceId: invoiceResult.squareInvoiceId,
        },
      });

      const recipients = await getOperationalRecipientIds({
        ownerId: clientAfterBilling.ownerId,
        closerId: clientAfterBilling.closedById,
      });
      await notifyUsers({
        userIds: recipients,
        type: "INVOICE_SENT",
        title: `Invoice sent: ${client.businessName}`,
        body: `$${websiteBuildAmount.toLocaleString()} website build invoice sent through Square.`,
        metadata: { clientId: client.id, invoiceId: invoice.id, squareInvoiceId: invoice.squareInvoiceId },
      });
    }

    let subscriptionResult:
      | Awaited<ReturnType<typeof createSquareSubscription>>
      | { unavailable: true; reason: string | null } = {
      unavailable: true,
      reason: "Retainer setup was not requested.",
    };

    if (body.setupRetainer !== false && retainerAmount > 0 && availability.available) {
      try {
        subscriptionResult = await createSquareSubscription({
          client: clientAfterBilling,
          tier: tier as "PROMO_100" | "STANDARD_200" | "CUSTOM",
          startDate: retainerStartDate,
        });
      } catch (error) {
        subscriptionResult = {
          unavailable: true,
          reason: error instanceof Error ? error.message : "Square subscription setup failed.",
        };
      }
    }

    if ("squareSubscriptionId" in subscriptionResult) {
      clientAfterBilling = await prisma.client.update({
        where: { id: client.id },
        data: {
          squareCustomerId: subscriptionResult.squareCustomerId,
          squareSubscriptionId: subscriptionResult.squareSubscriptionId,
          squareSubscriptionPlanVariationId: subscriptionResult.squareSubscriptionPlanVariationId,
          nextPaymentDate: subscriptionResult.nextPaymentDate,
          retainerPaymentStatus: "DUE_SOON",
        },
      });
      await prisma.clientPaymentEvent.create({
        data: {
          clientId: client.id,
          userId: auth.session.userId,
          type: "SUBSCRIPTION_CREATED",
          amount: retainerAmount,
          currency: "USD",
          squareSubscriptionId: subscriptionResult.squareSubscriptionId,
          status: subscriptionResult.status,
          message: `Retainer subscription created for ${tier}.`,
        },
      });
      await createLeadActivity({
        businessLeadId: client.businessLeadId,
        userId: auth.session.userId,
        type: "SUBSCRIPTION_UPDATED",
        title: "Retainer subscription setup",
        body: `$${retainerAmount.toLocaleString()} monthly retainer configured.`,
        metadata: { clientId: client.id, squareSubscriptionId: subscriptionResult.squareSubscriptionId },
      });
    }

    return NextResponse.json({
      client: clientAfterBilling,
      invoice,
      invoiceSent: "squareInvoiceId" in invoiceResult,
      invoiceError: "reason" in invoiceResult ? invoiceResult.reason : null,
      retainerSetup: "squareSubscriptionId" in subscriptionResult,
      retainerError: "reason" in subscriptionResult ? subscriptionResult.reason : null,
    });
  } catch (error) {
    console.error("[billing setup]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Billing setup failed" },
      { status: 500 }
    );
  }
}
