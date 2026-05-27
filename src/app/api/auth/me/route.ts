import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { fullName: true, avatarUrl: true, accountStatus: true },
  });
  return NextResponse.json({
    user: {
      ...session,
      fullName: user?.fullName ?? null,
      avatarUrl: user?.avatarUrl ?? null,
      accountStatus: user?.accountStatus ?? session.accountStatus,
    },
  });
}
