import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { AccountStatus, UserRole } from "@prisma/client";
import { SESSION_COOKIE, SESSION_SECRET_MIN_LENGTH } from "./constants";

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  accountStatus?: AccountStatus;
  mustChangePassword: boolean;
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < SESSION_SECRET_MIN_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be set and at least ${SESSION_SECRET_MIN_LENGTH} characters.`
    );
  }
  return new TextEncoder().encode(secret);
}

async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as UserRole,
      accountStatus: (payload.accountStatus as AccountStatus | undefined) ?? "ACTIVE",
      mustChangePassword: Boolean(payload.mustChangePassword),
    };
  } catch {
    return null;
  }
}

export async function createSession(
  payload: SessionPayload
): Promise<void> {
  const token = await new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    accountStatus: payload.accountStatus ?? "ACTIVE",
    mustChangePassword: payload.mustChangePassword,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
