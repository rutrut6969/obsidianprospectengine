import { prisma } from "@/lib/prisma";

export async function getDashboardStats() {
  const [
    totalLeads,
    highPriority,
    noWebsite,
    contacted,
    interested,
    clients,
    recentSearches,
  ] = await Promise.all([
    prisma.businessLead.count(),
    prisma.businessLead.count({ where: { leadScore: { gte: 80 } } }),
    prisma.businessLead.count({ where: { websiteStatus: "NO_WEBSITE" } }),
    prisma.businessLead.count({ where: { status: "CONTACTED" } }),
    prisma.businessLead.count({ where: { status: "INTERESTED" } }),
    prisma.businessLead.count({ where: { status: "CLIENT" } }),
    prisma.searchRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    totalLeads,
    highPriority,
    noWebsite,
    contacted,
    interested,
    clients,
    recentSearches,
  };
}
