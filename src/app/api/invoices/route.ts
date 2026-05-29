import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { clientVisibilityWhere, invoiceVisibilityWhere, leadVisibilityWhere } from "@/lib/auth/access";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const invoices = await prisma.invoice.findMany({
    where: invoiceVisibilityWhere(auth.session),
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { id: true, fullName: true, email: true } },
      client: { select: { id: true, businessName: true } },
      businessLead: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ invoices });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      businessLeadId?: string | null;
      clientId?: string | null;
      projectId?: string | null;
      title?: string;
      description?: string | null;
      amountDue?: number;
      retainerAmount?: number | null;
      dueDate?: string | null;
      notes?: string | null;
    };

    if (!body.title?.trim() || Number(body.amountDue ?? 0) <= 0) {
      return NextResponse.json(
        { error: "Title and amount due are required." },
        { status: 400 }
      );
    }

    if (body.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: body.clientId, ...clientVisibilityWhere(auth.session) },
      });
      if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (body.businessLeadId) {
      const lead = await prisma.businessLead.findFirst({
        where: { id: body.businessLeadId, ...leadVisibilityWhere(auth.session) },
      });
      if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const invoice = await prisma.invoice.create({
      data: {
        ownerId: auth.session.userId,
        businessLeadId: body.businessLeadId || null,
        clientId: body.clientId || null,
        projectId: body.projectId || null,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        amountDue: Number(body.amountDue),
        retainerAmount: body.retainerAmount != null ? Number(body.retainerAmount) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        status: "DRAFT",
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("[invoices POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invoice create failed" },
      { status: 500 }
    );
  }
}
