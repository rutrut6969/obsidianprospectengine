import { NextRequest, NextResponse } from "next/server";
import { ClientStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { clientVisibilityWhere } from "@/lib/auth/access";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const existing = await prisma.client.findFirst({
      where: { id, ...clientVisibilityWhere(auth.session) },
    });
    if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const body = (await request.json()) as {
      status?: ClientStatus;
      paymentStatus?: PaymentStatus;
      notes?: string | null;
      upfrontWebsitePrice?: number;
      retainerAmount?: number;
      retainerPaymentStatus?: "CURRENT" | "DUE_SOON" | "OVERDUE" | "FAILED" | "CANCELED" | "PAUSED";
      nextPaymentDate?: string | null;
      squareCustomerId?: string | null;
      squareSubscriptionId?: string | null;
    };

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(body.status && {
          status: body.status,
          closedById: body.status === "ACTIVE" ? existing.closedById ?? auth.session.userId : existing.closedById,
        }),
        ...(body.paymentStatus && { paymentStatus: body.paymentStatus }),
        ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
        ...(body.upfrontWebsitePrice !== undefined && {
          upfrontWebsitePrice: Number(body.upfrontWebsitePrice),
        }),
        ...(body.retainerAmount !== undefined && { retainerAmount: Number(body.retainerAmount) }),
        ...(body.retainerPaymentStatus && {
          retainerPaymentStatus: body.retainerPaymentStatus,
        }),
        ...(body.nextPaymentDate !== undefined && {
          nextPaymentDate: body.nextPaymentDate ? new Date(body.nextPaymentDate) : null,
        }),
        ...(body.squareCustomerId !== undefined && {
          squareCustomerId: body.squareCustomerId?.trim() || null,
        }),
        ...(body.squareSubscriptionId !== undefined && {
          squareSubscriptionId: body.squareSubscriptionId?.trim() || null,
        }),
      },
    });

    return NextResponse.json({ client });
  } catch (error) {
    console.error("[clients PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Client update failed" },
      { status: 500 }
    );
  }
}
