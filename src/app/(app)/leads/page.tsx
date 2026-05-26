import { SavedLeadsList } from "@/components/leads/saved-leads-list";

export default function LeadsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-purple-400">CRM</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-100">Saved Leads</h1>
        <p className="mt-2 text-slate-400">
          Manage your pipeline — filter by status and lead score.
        </p>
      </div>
      <SavedLeadsList />
    </div>
  );
}
