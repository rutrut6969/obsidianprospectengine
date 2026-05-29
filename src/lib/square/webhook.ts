import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createLeadActivity } from "@/lib/crm/activity";
import { getOperationalRecipientIds, notifyUsers } from "@/lib/notifications/service";

export interface SquareWebhookPayload {
  merchant_id?: string;
  type?: string;
  event_id?: string;
  created_at?: string;
  data?: {
    type?: string;
    id?: string;
    object?: Record<string, unknown>;
  };
}

function getWebhookUrl(): string {
  return (
    process.env.SQUARE_WEBHOOK_URL ??
    `${process.env.APP_URL ?? "https://prospect.obsidian-systems.tech"}/api/webhooks/square`
  );
}

export function verifySquareSignature(rawBody: string, signature: string | null): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key || !signature) return false;

  const hmac = crypto.createHmac("sha256", key);
  hmac.update(getWebhookUrl() + rawBody);
  const expected = hmac.digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function valueAt(object: Record<string, unknown> | undefined, keys: string[]): string | null {
  let current: unknown = object;
  for (const key of keys) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key];
  }
  if (typeof current === "string") return current;
  if (typeof current === "number") return String(current);
  return null;
}

function amountAt(object: Record<string, unknown> | undefined): number | null {
  const amountMoney =
    valueAt(object, ["amount_money", "amount"]) ??
    valueAt(object, ["payment", "amount_money", "amount"]);
  const totalMoney =
    valueAt(object, ["total_money", "amount"]) ??
    valueAt(object, ["invoice", "total_money", "amount"]);
  const value = amountMoney ?? totalMoney;
  return value ? Number(value) / 100 : null;
}

function invoiceStatusForEvent(eventType: string, object: Record<string, unknown> | undefined) {
  const squareStatus = valueAt(object, ["invoice", "status"]) ?? valueAt(object, ["status"]);
  if (eventType.includes("payment_made")) return "PAID";
  if (eventType.includes("payment_failed")) return "FAILED";
  if (eventType.includes("sent")) return "SENT";
  if (eventType.includes("viewed")) return "VIEWED";
  if (eventType.includes("created")) return "DRAFT";
  if (squareStatus === "PAID") return "PAID";
  if (squareStatus === "UNPAID" || squareStatus === "SCHEDULED") return "SENT";
  if (squareStatus === "CANCELED") return "CANCELED";
  return null;
}

export async function processSquareWebhook(payload: SquareWebhookPayload) {
  const eventType = payload.type ?? "unknown";
  const object = payload.data?.object;
  const eventId = payload.event_id ?? null;

  if (eventId) {
    const existing = await prisma.squareWebhookEvent.findUnique({
      where: { eventId },
    });
    if (existing) return { duplicate: true };
  }

  await prisma.squareWebhookEvent.create({
    data: {
      eventId,
      eventType,
      payload: payload as object,
    },
  });

  const squareCustomerId =
    valueAt(object, ["customer_id"]) ??
    valueAt(object, ["invoice", "primary_recipient", "customer_id"]) ??
    valueAt(object, ["payment", "customer_id"]);
  const squareInvoiceId =
    valueAt(object, ["invoice", "id"]) ?? valueAt(object, ["id"]);
  const squarePaymentId =
    valueAt(object, ["payment", "id"]) ?? (eventType.includes("payment") ? valueAt(object, ["id"]) : null);
  const squareSubscriptionId =
    valueAt(object, ["subscription", "id"]) ??
    valueAt(object, ["id"]) ??
    valueAt(object, ["subscription_id"]);

  const clientLookup = [
    squareCustomerId ? { squareCustomerId } : undefined,
    squareInvoiceId ? { latestSquareInvoiceId: squareInvoiceId } : undefined,
    squareSubscriptionId ? { squareSubscriptionId } : undefined,
    squarePaymentId ? { latestSquarePaymentId: squarePaymentId } : undefined,
  ].filter(Boolean);

  if (clientLookup.length === 0) return { processed: true, clientMatched: false };

  const invoice = squareInvoiceId || squarePaymentId
    ? await prisma.invoice.findFirst({
        where: {
          OR: [
            squareInvoiceId ? { squareInvoiceId } : undefined,
            squarePaymentId ? { squarePaymentId } : undefined,
          ].filter(Boolean) as never,
        },
        include: { client: true },
      })
    : null;

  const client = await prisma.client.findFirst({
    where: { OR: clientLookup as never },
  }) ?? invoice?.client ?? null;

  if (!client) return { processed: true, clientMatched: false };

  const isSuccess =
    eventType.includes("payment.created") ||
    eventType.includes("payment.updated") ||
    eventType.includes("invoice.payment_made");
  const isFailure =
    eventType.includes("payment.failed") ||
    eventType.includes("invoice.payment_failed") ||
    eventType.includes("subscription.canceled");
  const isSubscription =
    eventType.includes("subscription.created") ||
    eventType.includes("subscription.updated") ||
    eventType.includes("subscription.canceled");

  const amount = amountAt(object);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const latestInvoice =
      invoice ??
      (squareInvoiceId
        ? await tx.invoice.findFirst({ where: { squareInvoiceId } })
        : null);
    const nextInvoiceStatus = invoiceStatusForEvent(eventType, object);

    if (latestInvoice && nextInvoiceStatus) {
      await tx.invoice.update({
        where: { id: latestInvoice.id },
        data: {
          status: nextInvoiceStatus,
          ...(squareCustomerId && { squareCustomerId }),
          ...(squarePaymentId && { squarePaymentId }),
          ...(nextInvoiceStatus === "SENT" && { sentAt: latestInvoice.sentAt ?? now }),
          ...(nextInvoiceStatus === "VIEWED" && { viewedAt: latestInvoice.viewedAt ?? now }),
          ...(nextInvoiceStatus === "PAID" && { paidAt: latestInvoice.paidAt ?? now }),
        },
      });
    }

    const updatedClient = await tx.client.update({
      where: { id: client.id },
      data: {
        ...(squareCustomerId && { squareCustomerId }),
        ...(squareInvoiceId && { latestSquareInvoiceId: squareInvoiceId }),
        ...(squarePaymentId && { latestSquarePaymentId: squarePaymentId }),
        ...(squareSubscriptionId && { squareSubscriptionId }),
        ...(isSuccess && {
          retainerPaymentStatus: "CURRENT",
          paymentStatus: "PAID",
          lastPaymentDate: now,
          nextPaymentDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30),
        }),
        ...(isFailure && {
          retainerPaymentStatus: eventType.includes("canceled") ? "CANCELED" : "FAILED",
          paymentStatus: "FAILED",
        }),
        ...(isSubscription && !isFailure && {
          retainerPaymentStatus: "DUE_SOON",
        }),
      },
    });

    await tx.clientPaymentEvent.create({
      data: {
        clientId: client.id,
        userId: client.closedById ?? client.ownerId,
        type: isSuccess
          ? "PAYMENT_SUCCEEDED"
          : isFailure
            ? "PAYMENT_FAILED"
            : eventType.includes("subscription.canceled")
              ? "SUBSCRIPTION_CANCELED"
              : eventType.includes("subscription.created")
                ? "SUBSCRIPTION_CREATED"
                : eventType.includes("subscription")
                  ? "SUBSCRIPTION_UPDATED"
              : "INVOICE_VIEWED",
        amount,
        currency: "USD",
        squareEventId: eventId,
        squareInvoiceId,
        squarePaymentId,
        squareSubscriptionId,
        status: eventType,
        message: `Square event: ${eventType}`,
      },
    });

    if (isSuccess) {
      const commissionUserId = client.closedById ?? client.ownerId;
      if (commissionUserId && amount && amount > 0) {
        const existingCommission = await tx.commission.findFirst({
          where: {
            OR: [
              squarePaymentId ? { squarePaymentId } : undefined,
              eventId ? { squareEventId: eventId } : undefined,
            ].filter(Boolean) as never,
          },
        });

        if (!existingCommission) {
          const user = await tx.user.findUnique({ where: { id: commissionUserId } });
          const rate = user?.commissionRate ?? 0.1;
          const commission = await tx.commission.create({
            data: {
              userId: commissionUserId,
              clientId: client.id,
              invoiceId: latestInvoice?.id ?? null,
              saleAmount: amount,
              commissionRate: rate,
              commissionAmount: Math.round(amount * rate * 100) / 100,
              status: "READY_TO_PAY",
              squarePaymentId,
              squareEventId: eventId,
              notes: latestInvoice
                ? "Website build commission created from Square invoice payment."
                : "Retainer commission created from Square webhook.",
            },
          });

          await createLeadActivity({
            tx,
            businessLeadId: updatedClient.businessLeadId,
            userId: commissionUserId,
            type: "COMMISSION_CREATED",
            title: "Commission ready",
            body: `$${commission.commissionAmount.toLocaleString()} commission created from Square payment.`,
            metadata: { commissionId: commission.id, clientId: client.id, squarePaymentId },
          });
        }
      }
    }

    await createLeadActivity({
      tx,
      businessLeadId: updatedClient.businessLeadId,
      userId: client.closedById ?? client.ownerId,
      type: isSuccess ? "PAYMENT_RECEIVED" : isFailure ? "PAYMENT_FAILED" : "SUBSCRIPTION_UPDATED",
      title: isSuccess ? "Square payment received" : isFailure ? "Square payment failed" : "Square billing updated",
      body: amount ? `Amount: $${amount.toLocaleString()}` : `Square event: ${eventType}`,
      metadata: { eventId, eventType, clientId: client.id, invoiceId: latestInvoice?.id, squarePaymentId },
    });

    const recipients = await getOperationalRecipientIds({
      tx,
      ownerId: client.ownerId,
      closerId: client.closedById,
    });

    await notifyUsers({
      tx,
      userIds: recipients,
      type: isSuccess
        ? "PAYMENT_SUCCEEDED"
        : isFailure
          ? "PAYMENT_FAILED"
          : "SYSTEM",
      title: isSuccess
        ? `Payment received from ${updatedClient.businessName}`
        : isFailure
          ? `Payment issue for ${updatedClient.businessName}`
          : `Square update for ${updatedClient.businessName}`,
      body: amount ? `Amount: $${amount.toLocaleString()}` : eventType,
      metadata: { eventId, eventType, clientId: client.id, invoiceId: latestInvoice?.id, squarePaymentId },
    });
  });

  return { processed: true, clientMatched: true };
}
