import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/guards";
import {
  normalizeEmail,
  getAppUrl,
  INVITE_EXPIRY_DAYS,
  SUPER_ADMIN_EMAIL,
} from "@/lib/auth/constants";
import { sendInviteEmail } from "@/lib/email/resend";

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      createdBy: { select: { email: true } },
    },
  });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      isAuthorized: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ invites, users });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  try {
    const { email } = (await request.json()) as { email?: string };

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const normalized = normalizeEmail(email);

    if (normalized === normalizeEmail(SUPER_ADMIN_EMAIL)) {
      return NextResponse.json(
        { error: "Super admin account cannot be invited." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalized },
    });

    if (existingUser?.passwordHash) {
      return NextResponse.json(
        { error: "This user already has an active account." },
        { status: 400 }
      );
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const invite = await prisma.invite.create({
      data: {
        email: normalized,
        token,
        expiresAt,
        createdById: auth.session.userId,
      },
    });

    const inviteUrl = `${getAppUrl()}/invite/${token}`;

    try {
      await sendInviteEmail({
        to: normalized,
        inviteUrl,
        invitedByEmail: auth.session.email,
      });
    } catch (emailError) {
      await prisma.invite.delete({ where: { id: invite.id } });
      throw emailError;
    }

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt,
        inviteUrl,
      },
    });
  } catch (error) {
    console.error("[admin/invites]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invite failed" },
      { status: 500 }
    );
  }
}
