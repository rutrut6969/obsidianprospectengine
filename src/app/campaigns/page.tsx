import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  let campaigns: Awaited<ReturnType<typeof prisma.campaign.findMany>> = [];
  let dbError = false;

  try {
    campaigns = await prisma.campaign.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { leads: true } } },
    });
  } catch {
    dbError = true;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-purple-400">Outreach</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-100">
            Campaigns & Drafts
          </h1>
          <p className="mt-2 text-slate-400">
            Group leads by market and track outreach drafts per business.
          </p>
        </div>
      </div>

      {dbError && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Connect your database to manage campaigns.
        </div>
      )}

      <Card>
        <CardHeader
          title="Campaigns"
          description="Organize searches by category and geography"
        />
        <CardBody className="p-0">
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Megaphone className="h-10 w-10 text-slate-600 mb-3" />
              <p className="text-slate-500 text-sm max-w-md">
                No campaigns yet. Campaigns can be created via Prisma Studio or a
                future UI. Outreach drafts are generated from each lead detail page.
              </p>
              <Link href="/leads" className="mt-4">
                <Button variant="secondary">View Saved Leads</Button>
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Market</th>
                  <th className="px-6 py-3 font-medium">Leads</th>
                  <th className="px-6 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-800/50 hover:bg-slate-900/40"
                  >
                    <td className="px-6 py-3 font-medium text-slate-200">
                      {c.name}
                    </td>
                    <td className="px-6 py-3 text-slate-400">
                      {[c.businessCategory, c.city, c.state]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="px-6 py-3 text-emerald-400">
                      {"_count" in c ? (c as { _count: { leads: number } })._count.leads : 0}
                    </td>
                    <td className="px-6 py-3 text-slate-500">
                      {formatDate(c.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
