"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LeadScoreBadge, LeadStatusBadge, WebsiteStatusBadge } from "@/components/lead-badges";
import { Input, Select, Label } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";

interface SavedLead {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  websiteStatus: string;
  leadScore: number;
  status: string;
}

export function SavedLeadsList() {
  const [leads, setLeads] = useState<SavedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [minScore, setMinScore] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    async function fetchLeads() {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (minScore) params.set("minScore", minScore);
      if (q) params.set("q", q);

      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads ?? []);
      setLoading(false);
    }
    const t = setTimeout(fetchLeads, 300);
    return () => clearTimeout(t);
  }, [statusFilter, minScore, q]);

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="q">Search</Label>
            <Input
              id="q"
              placeholder="Name, city, category…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="NEW">New</option>
              <option value="SAVED">Saved</option>
              <option value="CONTACTED">Contacted</option>
              <option value="INTERESTED">Interested</option>
              <option value="NOT_INTERESTED">Not Interested</option>
              <option value="CLIENT">Client</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="minScore">Min Lead Score</Label>
            <Input
              id="minScore"
              type="number"
              placeholder="e.g. 80"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <p className="py-12 text-center text-slate-500">Loading leads…</p>
          ) : leads.length === 0 ? (
            <p className="py-12 text-center text-slate-500">
              No saved leads yet. Search and save leads from the results page.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-slate-400">
                    <th className="px-4 py-3 font-medium">Business</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Website</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-slate-800/50 hover:bg-slate-900/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-medium text-purple-300 hover:text-purple-200"
                        >
                          {lead.name}
                        </Link>
                        <p className="text-xs text-slate-500">{lead.category}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {[lead.city, lead.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <WebsiteStatusBadge
                          status={lead.websiteStatus as "NO_WEBSITE"}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <LeadScoreBadge score={lead.leadScore} />
                      </td>
                      <td className="px-4 py-3">
                        <LeadStatusBadge status={lead.status} />
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
