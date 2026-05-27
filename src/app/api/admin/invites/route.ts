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
import { sendLeadGeneratorInviteEmail } from "@/lib/email/resend";

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
      fullName: true,
      phoneNumber: true,
      commissionRate: true,
      accountStatus: true,
      preferredPayoutMethod: true,
      directDepositStatus: true,
      isAuthorized: true,
      lastLoginAt: true,
      createdAt: true,
      _count: {
        select: {
          ownedLeads: true,
          campaigns: true,
          outreachLogs: true,
          closedClients: true,
          commissions: true,
        },
      },
      commissions: {
        select: { commissionAmount: true, status: true },
      },
    },
  });

  return NextResponse.json({ invites, users });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  try {
    const { email, fullName, phoneNumber, role, commissionRate, notes } =
      (await request.json()) as {
        email?: string;
        fullName?: string;
        phoneNumber?: string;
        role?: "LEAD_GENERATOR" | "SUPER_ADMIN";
        commissionRate?: number;
        notes?: string;
      };

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
        role: role === "SUPER_ADMIN" ? "LEAD_GENERATOR" : "LEAD_GENERATOR",
        fullName: fullName?.trim() || null,
        phoneNumber: phoneNumber?.trim() || null,
        token,
        expiresAt,
        createdById: auth.session.userId,
      },
    });

    await prisma.user.upsert({
      where: { email: normalized },
      create: {
        email: normalized,
        fullName: fullName?.trim() || null,
        phoneNumber: phoneNumber?.trim() || null,
        role: "LEAD_GENERATOR",
        commissionRate:
          commissionRate != null ? Math.max(0, Number(commissionRate)) : 0.1,
        accountStatus: "INVITED",
        notes: notes?.trim() || null,
        isAuthorized: false,
        invitedById: auth.session.userId,
      },
      update: {
        fullName: fullName?.trim() || undefined,
        phoneNumber: phoneNumber?.trim() || undefined,
        commissionRate:
          commissionRate != null ? Math.max(0, Number(commissionRate)) : undefined,
        accountStatus: "INVITED",
        notes: notes?.trim() || undefined,
      },
    });

    const inviteUrl = `${getAppUrl()}/invite/${token}`;

    const emailResult = await sendLeadGeneratorInviteEmail({
      to: normalized,
      fullName: fullName?.trim() || null,
      inviteUrl,
    });

    if (!emailResult.sent) {
      console.error("[admin/invites] Invite created but email failed", {
        inviteId: invite.id,
        to: normalized,
        error: emailResult.error,
      });
    }

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt,
        inviteUrl,
      },
      emailSent: emailResult.sent,
      emailError: emailResult.error,
      resendMessageId: emailResult.messageId,
    });
  } catch (error) {
    console.error("[admin/invites]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invite failed" },
      { status: 500 }
    );
  }
}
