import { NextRequest, NextResponse } from "next/server";
import { CommissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { isSessionSuperAdmin } from "@/lib/auth/access";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  if (!isSessionSuperAdmin(auth.session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      commissionAmount?: number;
      status?: CommissionStatus;
      payoutDate?: string | null;
      notes?: string | null;
    };

    const commission = await prisma.commission.update({
      where: { id },
      data: {
        ...(body.commissionAmount !== undefined && {
          commissionAmount: Number(body.commissionAmount),
        }),
        ...(body.status && { status: body.status }),
        ...(body.payoutDate !== undefined && {
          payoutDate: body.payoutDate ? new Date(body.payoutDate) : null,
        }),
        ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
      },
    });

    return NextResponse.json({ commission });
  } catch (error) {
    console.error("[commissions PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Commission update failed" },
      { status: 500 }
    );
  }
}
