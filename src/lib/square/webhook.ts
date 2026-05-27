import crypto from "crypto";
import { prisma } from "@/lib/prisma";

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
  const amountMoney = valueAt(object, ["amount_money", "amount"]);
  const totalMoney = valueAt(object, ["total_money", "amount"]);
  const value = amountMoney ?? totalMoney;
  return value ? Number(value) / 100 : null;
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
  ].filter(Boolean);

  if (clientLookup.length === 0) return { processed: true, clientMatched: false };

  const client = await prisma.client.findFirst({
    where: { OR: clientLookup as never },
  });

  if (!client) return { processed: true, clientMatched: false };

  const isSuccess =
    eventType.includes("payment.created") ||
    eventType.includes("payment.updated") ||
    eventType.includes("invoice.payment_made") ||
    eventType.includes("subscription.updated");
  const isFailure =
    eventType.includes("payment.failed") ||
    eventType.includes("invoice.payment_failed") ||
    eventType.includes("subscription.canceled");

  const amount = amountAt(object);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
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
        const user = await tx.user.findUnique({ where: { id: commissionUserId } });
        const rate = user?.commissionRate ?? 0.1;
        await tx.commission.create({
          data: {
            userId: commissionUserId,
            clientId: client.id,
            saleAmount: amount,
            commissionRate: rate,
            commissionAmount: Math.round(amount * rate * 100) / 100,
            status: "READY_TO_PAY",
            notes: "Retainer commission created from Square webhook.",
          },
        });
      }
    }

    const notifyUsers = [
      client.closedById,
      client.ownerId,
      ...(await tx.user
        .findMany({ where: { role: "SUPER_ADMIN" }, select: { id: true } })
        .then((users) => users.map((user) => user.id))),
    ].filter((id, index, ids): id is string => Boolean(id) && ids.indexOf(id) === index);

    for (const userId of notifyUsers) {
      await tx.notification.create({
        data: {
          userId,
          type: isSuccess
            ? "PAYMENT_SUCCEEDED"
            : isFailure
              ? "PAYMENT_FAILED"
              : "SYSTEM",
          title: isSuccess
            ? `Retainer payment received from ${updatedClient.businessName}`
            : isFailure
              ? `Payment issue for ${updatedClient.businessName}`
              : `Square update for ${updatedClient.businessName}`,
          body: amount ? `Amount: $${amount.toLocaleString()}` : eventType,
          metadata: { eventId, eventType, clientId: client.id },
        },
      });
    }
  });

  return { processed: true, clientMatched: true };
}
