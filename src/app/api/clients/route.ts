import { NextRequest, NextResponse } from "next/server";
import { ClientStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { clientVisibilityWhere, leadVisibilityWhere } from "@/lib/auth/access";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const clients = await prisma.client.findMany({
    where: clientVisibilityWhere(auth.session),
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { id: true, fullName: true, email: true } },
      closedBy: { select: { id: true, fullName: true, email: true } },
      businessLead: { select: { id: true, name: true, category: true } },
      commissions: true,
      invoices: { orderBy: { createdAt: "desc" }, take: 3 },
      paymentEvents: { orderBy: { occurredAt: "desc" }, take: 5 },
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
      retainerBillingCycle?: "MONTHLY" | "QUARTERLY" | "ANNUAL";
      retainerStartDate?: string | null;
      squareCustomerId?: string | null;
      squareSubscriptionId?: string | null;
      nextPaymentDate?: string | null;
      paymentStatus?: PaymentStatus;
      status?: ClientStatus;
      notes?: string | null;
    };

    if (!body.businessName?.trim()) {
      return NextResponse.json({ error: "Business name is required." }, { status: 400 });
    }

    const lead = body.businessLeadId
      ? await prisma.businessLead.findFirst({
          where: { id: body.businessLeadId, ...leadVisibilityWhere(auth.session) },
        })
      : null;

    if (body.businessLeadId && !lead) {
      return NextResponse.json({ error: "Lead not found or unavailable." }, { status: 404 });
    }

    const duplicate = body.businessLeadId
      ? await prisma.client.findFirst({ where: { businessLeadId: body.businessLeadId } })
      : null;

    if (duplicate) {
      return NextResponse.json(
        { error: "This lead is already linked to a client." },
        { status: 409 }
      );
    }

    const client = await prisma.client.create({
      data: {
        businessLeadId: body.businessLeadId || null,
        ownerId: lead?.ownerId ?? auth.session.userId,
        closedById: body.status === "ACTIVE" ? auth.session.userId : null,
        businessName: body.businessName.trim(),
        businessCategory: lead?.category ?? null,
        contactEmail: body.contactEmail?.trim() || lead?.primaryEmail || null,
        contactPhone: body.contactPhone?.trim() || lead?.phone || null,
        websiteUrl: lead?.websiteUrl ?? null,
        city: lead?.city ?? null,
        state: lead?.state ?? null,
        contactName: body.contactName?.trim() || null,
        websitePackage: body.websitePackage?.trim() || null,
        upfrontWebsitePrice: Number(body.upfrontWebsitePrice ?? 0),
        retainerAmount: Number(body.retainerAmount ?? 0),
        retainerBillingCycle: body.retainerBillingCycle ?? "MONTHLY",
        retainerStartDate: body.retainerStartDate ? new Date(body.retainerStartDate) : null,
        squareCustomerId: body.squareCustomerId?.trim() || null,
        squareSubscriptionId: body.squareSubscriptionId?.trim() || null,
        nextPaymentDate: body.nextPaymentDate ? new Date(body.nextPaymentDate) : null,
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
