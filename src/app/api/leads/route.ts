import { NextRequest, NextResponse } from "next/server";
import { LeadStatus, Prisma, WebsiteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as LeadStatus | null;
    const minScore = searchParams.get("minScore");
    const websiteStatus = searchParams.get("websiteStatus");
    const category = searchParams.get("category");
    const city = searchParams.get("city");
    const state = searchParams.get("state");
    const includeDeleted = searchParams.get("includeDeleted") === "true";
    const sort = searchParams.get("sort") ?? "leadScore";
    const direction = searchParams.get("direction") === "asc" ? "asc" : "desc";
    const q = searchParams.get("q");

    const where: Prisma.BusinessLeadWhereInput = {};
    if (!includeDeleted) where.deletedAt = null;
    if (status) where.status = status;
    if (websiteStatus) where.websiteStatus = websiteStatus as WebsiteStatus;
    if (category) where.category = { equals: category, mode: "insensitive" };
    if (city) where.city = { equals: city, mode: "insensitive" };
    if (state) where.state = { equals: state.toUpperCase(), mode: "insensitive" };
    if (minScore) where.leadScore = { gte: Number(minScore) };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { state: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ];
    }

    const orderBy: Prisma.BusinessLeadOrderByWithRelationInput[] =
      sort === "category"
        ? [{ category: direction }, { name: "asc" }]
        : sort === "city"
          ? [{ city: direction }, { name: "asc" }]
          : sort === "websiteStatus"
            ? [{ websiteStatus: direction }, { leadScore: "desc" }]
            : sort === "reviewCount"
              ? [{ reviewCount: direction }, { leadScore: "desc" }]
              : [{ leadScore: direction }, { updatedAt: "desc" }];

    const leads = await prisma.businessLead.findMany({
      where,
      orderBy,
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
