import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, getAppUrl } from "@/lib/auth/constants";

export async function POST(request: NextRequest) {
  try {
    const { token } = (await request.json()) as { token?: string };

    if (!token) {
      return NextResponse.json({ error: "Token is required." }, { status: 400 });
    }

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { createdBy: true },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invite has expired." }, { status: 400 });
    }

    if (invite.usedAt) {
      const email = normalizeEmail(invite.email);
      const user = await prisma.user.findUnique({ where: { email } });
      if (user?.passwordHash) {
        return NextResponse.json({
          ok: true,
          redirectUrl: `${getAppUrl()}/login`,
          message: "Already authorized. Please log in.",
        });
      }
      return NextResponse.json({
        ok: true,
        redirectUrl: `${getAppUrl()}/setup-password?token=${token}`,
      });
    }

    const email = normalizeEmail(invite.email);

    await prisma.$transaction(async (tx) => {
      await tx.invite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });

      await tx.user.upsert({
        where: { email },
        create: {
          email,
          role: "USER",
          isAuthorized: true,
          mustChangePassword: false,
          invitedById: invite.createdById,
        },
        update: {
          isAuthorized: true,
          invitedById: invite.createdById,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      redirectUrl: `${getAppUrl()}/setup-password?token=${token}`,
      email,
    });
  } catch (error) {
    console.error("[invite/accept]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Accept failed" },
      { status: 500 }
    );
  }
}
