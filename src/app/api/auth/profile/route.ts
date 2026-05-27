import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const user = await prisma.user.findUnique({
    where: { id: auth.session.userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      role: true,
      commissionRate: true,
      accountStatus: true,
      lastLoginAt: true,
    },
  });

  return NextResponse.json({ user });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      fullName?: string | null;
      phoneNumber?: string | null;
    };

    const user = await prisma.user.update({
      where: { id: auth.session.userId },
      data: {
        ...(body.fullName !== undefined && { fullName: body.fullName?.trim() || null }),
        ...(body.phoneNumber !== undefined && {
          phoneNumber: body.phoneNumber?.trim() || null,
        }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        commissionRate: true,
        accountStatus: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[profile PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profile update failed" },
      { status: 500 }
    );
  }
}
