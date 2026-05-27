import { Invoice } from "@prisma/client";

export function getSquareAvailability() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  return {
    available: Boolean(accessToken && locationId),
    reason: accessToken && locationId
      ? null
      : "SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID are required to send Square invoices.",
  };
}

export async function createSquareInvoiceDraft(invoice: Invoice) {
  const availability = getSquareAvailability();
  if (!availability.available) {
    return { unavailable: true, reason: availability.reason };
  }

  // Queue-ready placeholder: Square payload creation is centralized here so the
  // app can swap this for the production API call without touching route logic.
  return {
    unavailable: false,
    squareInvoiceId: invoice.squareInvoiceId,
    invoiceUrl: invoice.invoiceUrl,
  };
}
