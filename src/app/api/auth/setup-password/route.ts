import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/auth/constants";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = (await request.json()) as {
      token?: string;
      password?: string;
    };

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required." },
        { status: 400 }
      );
    }

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 });
    }

    const invite = await prisma.invite.findUnique({ where: { token } });

    if (!invite || !invite.usedAt) {
      return NextResponse.json(
        { error: "Invalid or unauthorized invite. Accept the invite first." },
        { status: 400 }
      );
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invite has expired." }, { status: 400 });
    }

    const email = normalizeEmail(invite.email);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user?.isAuthorized) {
      return NextResponse.json({ error: "Account not authorized." }, { status: 400 });
    }

    if (user.passwordHash) {
      return NextResponse.json(
        { error: "Password already set. Please log in." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    await createSession({
      userId: updated.id,
      email: updated.email,
      role: updated.role,
      mustChangePassword: false,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/setup-password]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Setup failed" },
      { status: 500 }
    );
  }
}
