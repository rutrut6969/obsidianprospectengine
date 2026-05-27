import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const notifications = await prisma.notification.findMany({
    where: { userId: auth.session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ notifications });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
  }

  const notification = await prisma.notification.updateMany({
    where: { id: body.id, userId: auth.session.userId },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ notification });
}
