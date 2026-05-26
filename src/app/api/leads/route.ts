import { NextRequest, NextResponse } from "next/server";
import { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as LeadStatus | null;
    const minScore = searchParams.get("minScore");
    const websiteStatus = searchParams.get("websiteStatus");
    const q = searchParams.get("q");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (websiteStatus) where.websiteStatus = websiteStatus;
    if (minScore) where.leadScore = { gte: Number(minScore) };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ];
    }

    const leads = await prisma.businessLead.findMany({
      where,
      orderBy: [{ leadScore: "desc" }, { updatedAt: "desc" }],
      include: {
        websiteAudits: { orderBy: { createdAt: "desc" }, take: 1 },
        outreachDrafts: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
    });

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("[leads GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch leads" },
      { status: 500 }
    );
  }
}
