import crypto from "crypto";
import { Client, Invoice } from "@prisma/client";

type SquareMoney = { amount: number; currency: "USD" };

interface SquareErrorBody {
  errors?: Array<{ detail?: string; field?: string; code?: string }>;
}

interface SquareCustomer {
  id: string;
}

interface SquareOrder {
  id: string;
}

interface SquareInvoice {
  id: string;
  version?: number;
  public_url?: string;
  status?: string;
}

interface SquareSubscription {
  id: string;
  status?: string;
  charged_through_date?: string;
  start_date?: string;
  invoice_ids?: string[];
}

function squareBaseUrl() {
  return process.env.SQUARE_ENVIRONMENT?.toLowerCase() === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

function squareHeaders() {
  return {
    Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
    "Square-Version": "2026-05-20",
  };
}

function idempotencyKey(prefix: string, id: string) {
  return `${prefix}-${id}-${crypto.createHash("sha256").update(id).digest("hex").slice(0, 18)}`;
}

function toCents(amount: number): number {
  return Math.round(Number(amount || 0) * 100);
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function squareRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${squareBaseUrl()}${path}`, {
    ...init,
    headers: { ...squareHeaders(), ...(init.headers ?? {}) },
  });
  const data = (await response.json().catch(() => ({}))) as T & SquareErrorBody;

  if (!response.ok) {
    const detail = data.errors?.map((error) => error.detail ?? error.code).filter(Boolean).join("; ");
    throw new Error(detail || `Square request failed with ${response.status}`);
  }

  return data;
}

export function getSquareAvailability() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  return {
    available: Boolean(accessToken && locationId),
    reason:
      accessToken && locationId
        ? null
        : "SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID are required for Square billing.",
  };
}

export function getSquareRetainerPlanVariationId(tier: "PROMO_100" | "STANDARD_200" | "CUSTOM") {
  if (tier === "PROMO_100") return process.env.SQUARE_PROMO_RETAINER_PLAN_VARIATION_ID;
  if (tier === "STANDARD_200") return process.env.SQUARE_STANDARD_RETAINER_PLAN_VARIATION_ID;
  return null;
}

export async function ensureSquareCustomer(client: Client) {
  if (client.squareCustomerId) return { squareCustomerId: client.squareCustomerId, created: false };
  const availability = getSquareAvailability();
  if (!availability.available) return { unavailable: true, reason: availability.reason };

  const data = await squareRequest<{ customer: SquareCustomer }>("/v2/customers", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: idempotencyKey("customer", client.id),
      given_name: client.contactName ?? undefined,
      company_name: client.businessName,
      email_address: client.contactEmail ?? undefined,
      phone_number: client.contactPhone ?? undefined,
      reference_id: client.id,
      note: "Created by Obsidian Prospect Engine",
    }),
  });

  return { squareCustomerId: data.customer.id, created: true };
}

export async function createAndPublishSquareInvoice(params: {
  invoice: Invoice;
  client: Client;
}) {
  const availability = getSquareAvailability();
  if (!availability.available) return { unavailable: true, reason: availability.reason };

  const customer = await ensureSquareCustomer(params.client);
  if ("unavailable" in customer) return customer;
  const locationId = process.env.SQUARE_LOCATION_ID!;
  const dueDate = params.invoice.dueDate ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  const amountMoney: SquareMoney = { amount: toCents(params.invoice.amountDue), currency: "USD" };

  const orderData = await squareRequest<{ order: SquareOrder }>("/v2/orders", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: idempotencyKey("order", params.invoice.id),
      order: {
        location_id: locationId,
        customer_id: customer.squareCustomerId,
        reference_id: params.invoice.id,
        line_items: [
          {
            name: params.invoice.title,
            note: params.invoice.description ?? undefined,
            quantity: "1",
            base_price_money: amountMoney,
          },
        ],
      },
    }),
  });

  const invoiceData = await squareRequest<{ invoice: SquareInvoice }>("/v2/invoices", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: idempotencyKey("invoice", params.invoice.id),
      invoice: {
        order_id: orderData.order.id,
        location_id: locationId,
        title: params.invoice.title,
        description: params.invoice.description ?? undefined,
        delivery_method: "EMAIL",
        primary_recipient: { customer_id: customer.squareCustomerId },
        payment_requests: [
          {
            request_type: "BALANCE",
            due_date: toDateOnly(dueDate),
            automatic_payment_source: "NONE",
          },
        ],
      },
    }),
  });

  const published = await squareRequest<{ invoice: SquareInvoice }>(
    `/v2/invoices/${invoiceData.invoice.id}/publish`,
    {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: idempotencyKey("publish", params.invoice.id),
        version: invoiceData.invoice.version,
      }),
    }
  );

  return {
    unavailable: false,
    squareCustomerId: customer.squareCustomerId,
    squareOrderId: orderData.order.id,
    squareInvoiceId: published.invoice.id,
    invoiceUrl: published.invoice.public_url ?? invoiceData.invoice.public_url ?? null,
    status: published.invoice.status ?? "SENT",
    dueDate,
  };
}

export async function createSquareSubscription(params: {
  client: Client;
  tier: "PROMO_100" | "STANDARD_200" | "CUSTOM";
  startDate?: Date | null;
}) {
  const availability = getSquareAvailability();
  if (!availability.available) return { unavailable: true, reason: availability.reason };

  const planVariationId =
    params.tier === "CUSTOM"
      ? params.client.squareSubscriptionPlanVariationId
      : getSquareRetainerPlanVariationId(params.tier);

  if (!planVariationId) {
    return {
      unavailable: true,
      reason:
        params.tier === "PROMO_100"
          ? "SQUARE_PROMO_RETAINER_PLAN_VARIATION_ID is required for promo retainers."
          : params.tier === "STANDARD_200"
            ? "SQUARE_STANDARD_RETAINER_PLAN_VARIATION_ID is required for standard retainers."
            : "A Square plan variation ID is required for custom retainers.",
    };
  }

  const customer = await ensureSquareCustomer(params.client);
  if ("unavailable" in customer) return customer;

  const startDate = params.startDate ?? new Date();
  const data = await squareRequest<{ subscription: SquareSubscription }>("/v2/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: idempotencyKey("subscription", `${params.client.id}-${params.tier}`),
      location_id: process.env.SQUARE_LOCATION_ID,
      plan_variation_id: planVariationId,
      customer_id: customer.squareCustomerId,
      start_date: toDateOnly(startDate),
    }),
  });

  return {
    unavailable: false,
    squareCustomerId: customer.squareCustomerId,
    squareSubscriptionId: data.subscription.id,
    squareSubscriptionPlanVariationId: planVariationId,
    status: data.subscription.status ?? "ACTIVE",
    nextPaymentDate: data.subscription.charged_through_date
      ? new Date(data.subscription.charged_through_date)
      : new Date(startDate.getTime() + 1000 * 60 * 60 * 24 * 30),
  };
}

export async function createSquareInvoiceDraft(invoice: Invoice) {
  const availability = getSquareAvailability();
  if (!availability.available) return { unavailable: true, reason: availability.reason };
  return {
    unavailable: false,
    squareInvoiceId: invoice.squareInvoiceId,
    invoiceUrl: invoice.invoiceUrl,
  };
}
