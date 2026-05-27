import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { createSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/constants";
import { encryptSensitiveValue, last4, maskEnding } from "@/lib/security/encryption";

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
      avatarUrl: true,
      role: true,
      commissionRate: true,
      accountStatus: true,
      notes: true,
      bio: true,
      preferredPayoutMethod: true,
      cashAppTag: true,
      paypalEmail: true,
      venmoHandle: true,
      payoutLegalName: true,
      payoutNotes: true,
      bankName: true,
      bankAccountType: true,
      bankRoutingLast4: true,
      bankAccountLast4: true,
      directDepositStatus: true,
      lastProfileUpdatedAt: true,
      lastLoginAt: true,
      _count: {
        select: {
          ownedLeads: true,
          campaigns: true,
          closedClients: true,
          commissions: true,
        },
      },
      commissions: {
        where: { status: { in: ["READY_TO_PAY", "APPROVED", "PAID"] } },
        select: { commissionAmount: true, status: true },
      },
    },
  });

  return NextResponse.json({
    user: user
      ? {
          ...user,
          bankRoutingMasked: maskEnding(user.bankRoutingLast4),
          bankAccountMasked: maskEnding(user.bankAccountLast4),
        }
      : null,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      fullName?: string | null;
      email?: string | null;
      phoneNumber?: string | null;
      avatarUrl?: string | null;
      bio?: string | null;
      preferredPayoutMethod?:
        | "CASH_APP"
        | "PAYPAL"
        | "VENMO"
        | "DIRECT_DEPOSIT"
        | "MANUAL_CASH"
        | "CHECK"
        | null;
      cashAppTag?: string | null;
      paypalEmail?: string | null;
      venmoHandle?: string | null;
      payoutLegalName?: string | null;
      payoutNotes?: string | null;
      bankName?: string | null;
      bankAccountType?: "CHECKING" | "SAVINGS" | null;
      routingNumber?: string | null;
      accountNumber?: string | null;
    };

    let normalizedEmail: string | undefined;
    if (body.email !== undefined) {
      if (!body.email?.trim()) {
        return NextResponse.json({ error: "Email cannot be blank." }, { status: 400 });
      }
      normalizedEmail = normalizeEmail(body.email);
      const existing = await prisma.user.findFirst({
        where: { email: normalizedEmail, id: { not: auth.session.userId } },
      });
      if (existing) {
        return NextResponse.json({ error: "Email is already in use." }, { status: 400 });
      }
    }

    const user = await prisma.user.update({
      where: { id: auth.session.userId },
      data: {
        ...(body.fullName !== undefined && { fullName: body.fullName?.trim() || null }),
        ...(normalizedEmail && { email: normalizedEmail }),
        ...(body.phoneNumber !== undefined && {
          phoneNumber: body.phoneNumber?.trim() || null,
        }),
        ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl?.trim() || null }),
        ...(body.bio !== undefined && { bio: body.bio?.trim() || null }),
        ...(body.preferredPayoutMethod !== undefined && {
          preferredPayoutMethod: body.preferredPayoutMethod,
        }),
        ...(body.cashAppTag !== undefined && { cashAppTag: body.cashAppTag?.trim() || null }),
        ...(body.paypalEmail !== undefined && {
          paypalEmail: body.paypalEmail?.trim().toLowerCase() || null,
        }),
        ...(body.venmoHandle !== undefined && { venmoHandle: body.venmoHandle?.trim() || null }),
        ...(body.payoutLegalName !== undefined && {
          payoutLegalName: body.payoutLegalName?.trim() || null,
        }),
        ...(body.payoutNotes !== undefined && { payoutNotes: body.payoutNotes?.trim() || null }),
        ...(body.bankName !== undefined && { bankName: body.bankName?.trim() || null }),
        ...(body.bankAccountType !== undefined && { bankAccountType: body.bankAccountType }),
        ...(body.routingNumber !== undefined && {
          bankRoutingEncrypted: encryptSensitiveValue(body.routingNumber),
          bankRoutingLast4: last4(body.routingNumber),
        }),
        ...(body.accountNumber !== undefined && {
          bankAccountEncrypted: encryptSensitiveValue(body.accountNumber),
          bankAccountLast4: last4(body.accountNumber),
        }),
        ...((body.routingNumber || body.accountNumber || body.bankName || body.bankAccountType) && {
          directDepositStatus: "PENDING_VERIFICATION" as const,
        }),
        lastProfileUpdatedAt: new Date(),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        avatarUrl: true,
        role: true,
        commissionRate: true,
        accountStatus: true,
        bio: true,
        preferredPayoutMethod: true,
        cashAppTag: true,
        paypalEmail: true,
        venmoHandle: true,
        payoutLegalName: true,
        payoutNotes: true,
        bankName: true,
        bankAccountType: true,
        bankRoutingLast4: true,
        bankAccountLast4: true,
        directDepositStatus: true,
        lastProfileUpdatedAt: true,
      },
    });

    if (normalizedEmail) {
      await createSession({
        userId: user.id,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        mustChangePassword: false,
      });
    }

    return NextResponse.json({
      user: {
        ...user,
        bankRoutingMasked: maskEnding(user.bankRoutingLast4),
        bankAccountMasked: maskEnding(user.bankAccountLast4),
      },
    });
  } catch (error) {
    console.error("[profile PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profile update failed" },
      { status: 500 }
    );
  }
}
