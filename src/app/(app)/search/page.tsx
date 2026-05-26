import { LeadSearchForm } from "@/components/search/lead-search-form";

export default function SearchPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-purple-400">Discover</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-100">Lead Search</h1>
        <p className="mt-2 text-slate-400 max-w-2xl">
          Find local businesses via Google Places API. Each result is automatically
          audited for website status and scored for outreach priority.
        </p>
      </div>
      <LeadSearchForm />
    </div>
  );
}
