import { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = typeof prisma | Prisma.TransactionClient;

export async function createLeadActivity(params: {
  tx?: DbClient;
  businessLeadId: string | null | undefined;
  userId?: string | null;
  type: ActivityType;
  title: string;
  body?: string | null;
  metadata?: object | null;
}) {
  if (!params.businessLeadId) return null;
  const client = params.tx ?? prisma;
  return client.leadActivity.create({
    data: {
      businessLeadId: params.businessLeadId,
      userId: params.userId ?? null,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      metadata: params.metadata ?? undefined,
    },
  });
}
