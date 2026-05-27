import { NextRequest, NextResponse } from "next/server";
import { AccountStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/guards";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      fullName?: string | null;
      phoneNumber?: string | null;
      role?: UserRole;
      commissionRate?: number;
      accountStatus?: AccountStatus;
      notes?: string | null;
    };

    if (body.role === "SUPER_ADMIN" && id !== auth.session.userId) {
      return NextResponse.json(
        { error: "Promoting another user to SUPER_ADMIN is disabled in this UI." },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.fullName !== undefined && { fullName: body.fullName?.trim() || null }),
        ...(body.phoneNumber !== undefined && {
          phoneNumber: body.phoneNumber?.trim() || null,
        }),
        ...(body.role && { role: body.role }),
        ...(body.commissionRate !== undefined && {
          commissionRate: Math.max(0, Number(body.commissionRate)),
        }),
        ...(body.accountStatus && { accountStatus: body.accountStatus }),
        ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
      role: true,
      commissionRate: true,
      accountStatus: true,
      notes: true,
      directDepositStatus: true,
      preferredPayoutMethod: true,
      updatedAt: true,
    },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[admin/users PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "User update failed" },
      { status: 500 }
    );
  }
}
