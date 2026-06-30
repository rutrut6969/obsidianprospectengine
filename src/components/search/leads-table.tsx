"use client";

import { useState } from "react";
import { ExternalLink, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadScoreBadge, WebsiteStatusBadge } from "@/components/lead-badges";
import { SearchLeadResult } from "@/types/lead";
import {
  LEAD_SEARCH_WEBSITE_FILTER_LABELS,
  LeadSearchWebsiteFilter,
  MIN_VISIBLE_LEAD_SCORE,
} from "@/lib/search-filters";

export function LeadsTable({
  leads,
  showSave = true,
  activeFilter = "ALL",
}: {
  leads: SearchLeadResult[];
  showSave?: boolean;
  activeFilter?: LeadSearchWebsiteFilter;
}) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  async function saveLead(lead: SearchLeadResult) {
    setSavingId(lead.placeId);
    try {
      const res = await fetch("/api/save-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lead, status: "SAVED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSavedIds((prev) => new Set(prev).add(lead.placeId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingId(null);
    }
  }

  if (leads.length === 0) {
    return (
      <p className="py-12 text-center text-slate-500">
        No leads found with score {MIN_VISIBLE_LEAD_SCORE}+ for this filter.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Active filter:</span>
        <span className="rounded-full border border-purple-500/30 bg-purple-600/15 px-3 py-1 text-purple-100">
          {LEAD_SEARCH_WEBSITE_FILTER_LABELS[activeFilter]}
        </span>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-600/15 px-3 py-1 text-emerald-100">
          Score {MIN_VISIBLE_LEAD_SCORE}+
        </span>
      </div>
      <div className="space-y-3 md:hidden">
        {leads.map((lead) => (
          <div key={lead.placeId} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-100">{lead.name}</p>
                <p className="mt-1 text-xs text-slate-500">{lead.address}</p>
              </div>
              <LeadScoreBadge score={lead.leadScore} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <WebsiteStatusBadge status={lead.websiteStatus} />
              {lead.category && (
                <span className="rounded-full border border-purple-500/30 bg-purple-600/15 px-2 py-1 text-xs text-purple-200">
                  {lead.category}
                </span>
              )}
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-300">
              <p><span className="text-slate-500">Phone:</span> {lead.phone ?? "-"}</p>
              <p>
                <span className="text-slate-500">Rating:</span>{" "}
                {lead.rating != null ? `${lead.rating.toFixed(1)} (${lead.reviewCount ?? 0})` : "-"}
              </p>
            </div>
            {showSave && (
              <div className="mt-4 flex flex-wrap gap-2">
                {lead.googleMapsUrl && (
                  <a
                    href={lead.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:text-purple-300"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Maps
                  </a>
                )}
                {savedIds.has(lead.placeId) ? (
                  <span className="inline-flex min-h-10 items-center gap-1 text-sm text-emerald-400">
                    <Check className="h-4 w-4" /> Saved
                  </span>
                ) : (
                  <Button
                    variant="secondary"
                    loading={savingId === lead.placeId}
                    onClick={() => saveLead(lead)}
                    className="flex-1"
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left text-slate-400">
            <th className="px-4 py-3 font-medium">Business</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Phone</th>
            <th className="px-4 py-3 font-medium">Website Status</th>
            <th className="px-4 py-3 font-medium">Rating</th>
            <th className="px-4 py-3 font-medium">Lead Score</th>
            {showSave && <th className="px-4 py-3 font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.placeId}
              className="border-b border-slate-800/50 hover:bg-slate-900/40"
            >
              <td className="px-4 py-3">
                <p className="font-medium text-slate-100">{lead.name}</p>
                <p className="text-xs text-slate-500 mt-0.5 max-w-xs truncate">
                  {lead.address}
                </p>
              </td>
              <td className="px-4 py-3 text-slate-400">{lead.category ?? "—"}</td>
              <td className="px-4 py-3 text-slate-300">{lead.phone ?? "—"}</td>
              <td className="px-4 py-3">
                <WebsiteStatusBadge status={lead.websiteStatus} />
              </td>
              <td className="px-4 py-3 text-slate-300">
                {lead.rating != null ? (
                  <>
                    {lead.rating.toFixed(1)}
                    <span className="text-slate-500 text-xs ml-1">
                      ({lead.reviewCount ?? 0})
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3">
                <LeadScoreBadge score={lead.leadScore} />
              </td>
              {showSave && (
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {lead.googleMapsUrl && (
                      <a
                        href={lead.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-purple-400"
                        title="Google Maps"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {savedIds.has(lead.placeId) ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <Check className="h-3.5 w-3.5" /> Saved
                      </span>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={savingId === lead.placeId}
                        onClick={() => saveLead(lead)}
                      >
                        <Save className="h-3.5 w-3.5" />
                        Save
                      </Button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
