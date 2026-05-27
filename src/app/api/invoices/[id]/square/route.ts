import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { isSessionSuperAdmin } from "@/lib/auth/access";
import { createSquareInvoiceDraft, getSquareAvailability } from "@/lib/invoices/square";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, ...(isSessionSuperAdmin(auth.session) ? {} : { ownerId: auth.session.userId }) },
    });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const availability = getSquareAvailability();
    if (!availability.available) {
      return NextResponse.json({ unavailable: true, reason: availability.reason });
    }

    const result = await createSquareInvoiceDraft(invoice);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[square invoice]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Square invoice failed" },
      { status: 500 }
    );
  }
}
