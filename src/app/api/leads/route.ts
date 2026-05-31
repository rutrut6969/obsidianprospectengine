import { NextRequest, NextResponse } from "next/server";
import { LeadStatus, Prisma, WebsiteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { isSessionSuperAdmin, leadVisibilityWhere } from "@/lib/auth/access";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

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
    const ownership = searchParams.get("ownership");

    const filters: Prisma.BusinessLeadWhereInput[] = [leadVisibilityWhere(auth.session)];
    if (!includeDeleted) filters.push({ deletedAt: null });
    if (status) filters.push({ status });
    if (websiteStatus) filters.push({ websiteStatus: websiteStatus as WebsiteStatus });
    if (category) filters.push({ category: { equals: category, mode: "insensitive" } });
    if (city) filters.push({ city: { equals: city, mode: "insensitive" } });
    if (state) filters.push({ state: { equals: state.toUpperCase(), mode: "insensitive" } });
    if (minScore) filters.push({ leadScore: { gte: Number(minScore) } });
    if (ownership === "mine") {
      filters.push({ ownerId: auth.session.userId });
    } else if (ownership === "global") {
      filters.push({ visibility: "GLOBAL" });
    }
    if (q) {
      filters.push({
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
          { state: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    const where: Prisma.BusinessLeadWhereInput = { AND: filters };

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
        owner: { select: { id: true, fullName: true, email: true, role: true } },
        websiteAudits: { orderBy: { createdAt: "desc" }, take: 1 },
        outreachDrafts: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
    });

    return NextResponse.json({
      leads: leads.map((lead) => ({
        ...lead,
        ownershipKind:
          lead.ownerId === auth.session.userId
            ? "MY_LEAD"
            : lead.visibility === "GLOBAL"
              ? "GLOBAL"
              : "PRIVATE",
        isMine: lead.ownerId === auth.session.userId,
        isGlobal: lead.visibility === "GLOBAL",
        isAdminLead: lead.visibility === "GLOBAL" && !lead.ownerId
          ? true
          : lead.owner?.role === "SUPER_ADMIN",
        canManage: isSessionSuperAdmin(auth.session) || lead.ownerId === auth.session.userId,
      })),
    });
  } catch (error) {
    console.error("[leads GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch leads" },
      { status: 500 }
    );
  }
}
