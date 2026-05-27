import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/auth/constants";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = (await request.json()) as {
      email?: string;
      password?: string;
    };

    if (!email?.trim() || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const normalized = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalized } });

    if (!user?.isAuthorized || !user.passwordHash) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    if (user.accountStatus === "SUSPENDED") {
      return NextResponse.json(
        { error: "This account is suspended." },
        { status: 403 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), accountStatus: "ACTIVE" },
    });

    await createSession({
      userId: user.id,
      email: user.email,
      role: updated.role,
      accountStatus: updated.accountStatus,
      mustChangePassword: user.mustChangePassword,
    });

    return NextResponse.json({
      ok: true,
      mustChangePassword: user.mustChangePassword,
      role: updated.role,
    });
  } catch (error) {
    console.error("[auth/login]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed" },
      { status: 500 }
    );
  }
}
