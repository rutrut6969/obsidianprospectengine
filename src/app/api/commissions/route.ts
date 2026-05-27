import { NextRequest, NextResponse } from "next/server";
import { CommissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { isSessionSuperAdmin } from "@/lib/auth/access";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const commissions = await prisma.commission.findMany({
    where: isSessionSuperAdmin(auth.session) ? {} : { userId: auth.session.userId },
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      client: { select: { id: true, businessName: true } },
      invoice: { select: { id: true, title: true, status: true } },
    },
  });

  return NextResponse.json({ commissions });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      userId?: string;
      clientId?: string | null;
      invoiceId?: string | null;
      saleAmount?: number;
      commissionRate?: number;
      status?: CommissionStatus;
      notes?: string | null;
    };

    const targetUserId =
      isSessionSuperAdmin(auth.session) && body.userId ? body.userId : auth.session.userId;
    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const saleAmount = Number(body.saleAmount ?? 0);
    if (saleAmount <= 0) {
      return NextResponse.json({ error: "Sale amount must be greater than zero." }, { status: 400 });
    }
    const commissionRate = body.commissionRate ?? user.commissionRate ?? 0.1;

    const commission = await prisma.commission.create({
      data: {
        userId: targetUserId,
        clientId: body.clientId || null,
        invoiceId: body.invoiceId || null,
        saleAmount,
        commissionRate,
        commissionAmount: Math.round(saleAmount * commissionRate * 100) / 100,
        status: body.status ?? "PENDING",
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json({ commission });
  } catch (error) {
    console.error("[commissions POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Commission create failed" },
      { status: 500 }
    );
  }
}
