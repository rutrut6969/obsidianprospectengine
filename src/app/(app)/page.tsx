import Link from "next/link";
import {
  Users,
  Flame,
  Globe,
  Phone,
  Heart,
  Trophy,
  Search,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardStats } from "@/lib/dashboard-stats";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let stats;
  let dbError = false;

  try {
    stats = await getDashboardStats();
  } catch {
    dbError = true;
    stats = {
      totalLeads: 0,
      highPriority: 0,
      noWebsite: 0,
      contacted: 0,
      interested: 0,
      clients: 0,
      recentSearches: [],
    };
  }

  return (
    <div className="prospect-grid space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-purple-400">Obsidian Systems LLC</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-100">Dashboard</h1>
          <p className="mt-2 text-slate-400">
            Website development lead pipeline overview
          </p>
        </div>
        <Link href="/search">
          <Button>
            <Search className="h-4 w-4" />
            New Lead Search
          </Button>
        </Link>
      </div>

      {dbError && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Database not connected. Set <code className="text-amber-400">DATABASE_URL</code> in{" "}
          <code className="text-amber-400">.env</code> and run{" "}
          <code className="text-amber-400">npm run db:push</code>.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Leads" value={stats.totalLeads} icon={Users} accent="purple" />
        <StatCard
          label="High Priority (80+)"
          value={stats.highPriority}
          icon={Flame}
          accent="green"
        />
        <StatCard
          label="No Website"
          value={stats.noWebsite}
          icon={Globe}
          accent="green"
        />
        <StatCard label="Contacted" value={stats.contacted} icon={Phone} accent="amber" />
        <StatCard label="Interested" value={stats.interested} icon={Heart} accent="green" />
        <StatCard label="Clients" value={stats.clients} icon={Trophy} accent="purple" />
      </div>

      <Card>
        <CardHeader title="Recent Searches" description="Latest Google Places search runs" />
        <CardBody className="p-0">
          {stats.recentSearches.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">
              No searches yet. Start a lead search to populate results.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-slate-400">
                    <th className="px-6 py-3 font-medium">Query</th>
                    <th className="px-6 py-3 font-medium">Location</th>
                    <th className="px-6 py-3 font-medium">Radius</th>
                    <th className="px-6 py-3 font-medium">Results</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentSearches.map((run) => (
                    <tr
                      key={run.id}
                      className="border-b border-slate-800/50 hover:bg-slate-900/50"
                    >
                      <td className="px-6 py-3 text-slate-200">{run.query}</td>
                      <td className="px-6 py-3 text-slate-400">
                        {run.city}, {run.state}
                      </td>
                      <td className="px-6 py-3 text-slate-400">{run.radius} mi</td>
                      <td className="px-6 py-3">
                        <span className="text-emerald-400 font-medium">
                          {run.resultCount}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-500">
                        {formatDate(run.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
