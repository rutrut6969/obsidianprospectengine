import { CampaignsDashboard } from "@/components/campaigns/campaigns-dashboard";

export default function CampaignsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-purple-400">Outreach</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-100">Campaigns</h1>
        <p className="mt-2 text-slate-400">
          Build email or SMS campaigns, generate drafts, and track outreach results.
        </p>
      </div>
      <CampaignsDashboard />
    </div>
  );
}
