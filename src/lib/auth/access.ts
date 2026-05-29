import { Prisma } from "@prisma/client";
import { SessionPayload } from "./session";

export function isSessionSuperAdmin(session: SessionPayload): boolean {
  return session.role === "SUPER_ADMIN";
}

export function isSessionLeadGenerator(session: SessionPayload): boolean {
  return session.role === "LEAD_GENERATOR" || session.role === "USER";
}

export function leadVisibilityWhere(
  session: SessionPayload
): Prisma.BusinessLeadWhereInput {
  if (isSessionSuperAdmin(session)) return {};
  return {
    OR: [{ ownerId: session.userId }, { visibility: "GLOBAL" }],
  };
}

export function ownerScopedWhere<T extends { ownerId?: string | null }>(
  session: SessionPayload
): Partial<T> {
  return isSessionSuperAdmin(session) ? {} : ({ ownerId: session.userId } as Partial<T>);
}

export function clientVisibilityWhere(
  session: SessionPayload
): Prisma.ClientWhereInput {
  if (isSessionSuperAdmin(session)) return {};
  return {
    OR: [{ ownerId: session.userId }, { closedById: session.userId }],
  };
}

export function invoiceVisibilityWhere(
  session: SessionPayload
): Prisma.InvoiceWhereInput {
  if (isSessionSuperAdmin(session)) return {};
  return {
    OR: [
      { ownerId: session.userId },
      { client: { OR: [{ ownerId: session.userId }, { closedById: session.userId }] } },
    ],
  };
}

export function defaultLeadOwnership(session: SessionPayload): {
  ownerId: string;
  visibility: "GLOBAL" | "PRIVATE";
} {
  return {
    ownerId: session.userId,
    visibility: isSessionSuperAdmin(session) ? "GLOBAL" : "PRIVATE",
  };
}
