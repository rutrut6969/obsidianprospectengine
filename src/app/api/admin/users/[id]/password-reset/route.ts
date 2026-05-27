import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/auth/constants";
import { requireSuperAdmin } from "@/lib/auth/guards";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await prisma.passwordResetToken.create({
      data: { userId: id, token, expiresAt },
    });

    return NextResponse.json({
      resetUrl: `${getAppUrl()}/setup-password?reset=${token}`,
      expiresAt,
    });
  } catch (error) {
    console.error("[password-reset]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Password reset failed" },
      { status: 500 }
    );
  }
}
