"use client";

import { useState } from "react";
import { ExternalLink, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadScoreBadge, WebsiteStatusBadge } from "@/components/lead-badges";
import { SearchLeadResult } from "@/types/lead";

export function LeadsTable({
  leads,
  showSave = true,
}: {
  leads: SearchLeadResult[];
  showSave?: boolean;
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
        No leads to display. Run a search first.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
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
  );
}
