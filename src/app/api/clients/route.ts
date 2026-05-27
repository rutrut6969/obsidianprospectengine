import { NextRequest, NextResponse } from "next/server";
import { ClientStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { isSessionSuperAdmin } from "@/lib/auth/access";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const clients = await prisma.client.findMany({
    where: isSessionSuperAdmin(auth.session) ? {} : { ownerId: auth.session.userId },
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { id: true, fullName: true, email: true } },
      closedBy: { select: { id: true, fullName: true, email: true } },
      businessLead: { select: { id: true, name: true, category: true } },
      commissions: true,
    },
  });

  return NextResponse.json({ clients });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      businessLeadId?: string | null;
      businessName?: string;
      contactName?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      websitePackage?: string | null;
      upfrontWebsitePrice?: number;
      retainerAmount?: number;
      retainerStartDate?: string | null;
      paymentStatus?: PaymentStatus;
      status?: ClientStatus;
      notes?: string | null;
    };

    if (!body.businessName?.trim()) {
      return NextResponse.json({ error: "Business name is required." }, { status: 400 });
    }

    const client = await prisma.client.create({
      data: {
        businessLeadId: body.businessLeadId || null,
        ownerId: auth.session.userId,
        closedById: body.status === "ACTIVE" ? auth.session.userId : null,
        businessName: body.businessName.trim(),
        contactName: body.contactName?.trim() || null,
        contactEmail: body.contactEmail?.trim() || null,
        contactPhone: body.contactPhone?.trim() || null,
        websitePackage: body.websitePackage?.trim() || null,
        upfrontWebsitePrice: Number(body.upfrontWebsitePrice ?? 0),
        retainerAmount: Number(body.retainerAmount ?? 0),
        retainerStartDate: body.retainerStartDate ? new Date(body.retainerStartDate) : null,
        paymentStatus: body.paymentStatus ?? "UNPAID",
        status: body.status ?? "PROSPECT",
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json({ client });
  } catch (error) {
    console.error("[clients POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Client create failed" },
      { status: 500 }
    );
  }
}
