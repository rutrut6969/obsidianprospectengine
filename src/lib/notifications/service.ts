import {
  NotificationDeliveryStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = typeof prisma | Prisma.TransactionClient;

export async function getOperationalRecipientIds(params: {
  tx?: DbClient;
  ownerId?: string | null;
  closerId?: string | null;
}) {
  const client = params.tx ?? prisma;
  const superAdmins = await client.user.findMany({
    where: { role: "SUPER_ADMIN" },
    select: { id: true },
  });
  return [
    params.ownerId,
    params.closerId,
    ...superAdmins.map((user) => user.id),
  ].filter((id, index, ids): id is string => Boolean(id) && ids.indexOf(id) === index);
}

export async function notifyUsers(params: {
  tx?: DbClient;
  userIds: string[];
  type: NotificationType;
  title: string;
  body?: string | null;
  metadata?: Prisma.InputJsonValue;
  status?: NotificationDeliveryStatus;
  provider?: string | null;
  error?: string | null;
}) {
  const client = params.tx ?? prisma;
  const uniqueUserIds = params.userIds.filter(
    (id, index, ids) => Boolean(id) && ids.indexOf(id) === index
  );

  if (uniqueUserIds.length === 0) return [];

  return Promise.all(
    uniqueUserIds.map((userId) =>
      client.notification.create({
        data: {
          userId,
          type: params.type,
          title: params.title,
          body: params.body ?? null,
          metadata: params.metadata,
          channel: "IN_APP",
          provider: params.provider ?? "internal",
          status: params.status ?? "SENT",
          error: params.error ?? null,
          sentAt: new Date(),
        },
      })
    )
  );
}
