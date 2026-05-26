"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Trash2, X } from "lucide-react";
import {
  LeadScoreBadge,
  LeadStatusBadge,
  WebsiteStatusBadge,
} from "@/components/lead-badges";
import { Input, Select, Label } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WebsiteStatus } from "@prisma/client";

interface SavedLead {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  websiteStatus: WebsiteStatus;
  leadScore: number;
  status: string;
}

export function SavedLeadsList() {
  const [leads, setLeads] = useState<SavedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [websiteStatusFilter, setWebsiteStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [minScore, setMinScore] = useState("");
  const [sort, setSort] = useState("leadScore");
  const [direction, setDirection] = useState("desc");
  const [q, setQ] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SavedLead | null>(null);
  const [deleting, setDeleting] = useState(false);

  function buildParams() {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (websiteStatusFilter) params.set("websiteStatus", websiteStatusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (minScore) params.set("minScore", minScore);
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    if (direction) params.set("direction", direction);
    return params;
  }

  async function fetchLeads() {
    setLoading(true);
    const res = await fetch(`/api/leads?${buildParams()}`);
    const data = await res.json();
    setLeads(data.leads ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(fetchLeads, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, websiteStatusFilter, categoryFilter, minScore, q, sort, direction]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/leads/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
      return;
    }
    setDeleteTarget(null);
    await fetchLeads();
  }

  function exportLeads(format: "csv" | "xlsx" | "pdf" | "docx") {
    const params = buildParams();
    params.set("format", format);
    window.location.href = `/api/leads/export?${params.toString()}`;
  }

  const categories = Array.from(
    new Set(leads.map((lead) => lead.category).filter(Boolean))
  ) as string[];

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <Label htmlFor="q">Search</Label>
            <Input
              id="q"
              placeholder="Name, city, category"
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
            <Label htmlFor="websiteStatus">Website</Label>
            <Select
              id="websiteStatus"
              value={websiteStatusFilter}
              onChange={(e) => setWebsiteStatusFilter(e.target.value)}
            >
              <option value="">All website statuses</option>
              <option value="NO_WEBSITE">No Website</option>
              <option value="FACEBOOK_ONLY">Facebook Only</option>
              <option value="BROKEN_WEBSITE">Broken</option>
              <option value="OUTDATED_WEBSITE">Outdated</option>
              <option value="HAS_WEBSITE">Has Website</option>
              <option value="UNKNOWN">Unknown</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              list="lead-categories"
              placeholder="Filter category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
            <datalist id="lead-categories">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="minScore">Min Score</Label>
            <Input
              id="minScore"
              type="number"
              placeholder="80"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sort">Sort</Label>
            <Select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="leadScore">Lead score</option>
              <option value="category">Category</option>
              <option value="city">City</option>
              <option value="websiteStatus">Website status</option>
              <option value="reviewCount">Review count</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="direction">Direction</Label>
            <Select
              id="direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="desc">High to low</option>
              <option value="asc">Low to high</option>
            </Select>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{leads.length} leads shown</p>
        <div className="flex flex-wrap gap-2">
          {(["csv", "xlsx", "pdf", "docx"] as const).map((format) => (
            <Button
              key={format}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => exportLeads(format)}
            >
              <Download className="h-3.5 w-3.5" />
              {format.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <p className="py-12 text-center text-slate-500">Loading leads...</p>
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
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Website</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Reviews</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
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
                        {lead.websiteUrl && (
                          <p className="max-w-xs truncate text-xs text-slate-500">
                            {lead.websiteUrl}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lead.category ? (
                          <Badge variant="purple">{lead.category}</Badge>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {[lead.city, lead.state].filter(Boolean).join(", ") || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{lead.phone ?? "-"}</td>
                      <td className="px-4 py-3">
                        <WebsiteStatusBadge status={lead.websiteStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <LeadScoreBadge score={lead.leadScore} />
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {lead.rating != null ? (
                          <>
                            {lead.rating.toFixed(1)}
                            <span className="ml-1 text-xs text-slate-500">
                              ({lead.reviewCount ?? 0})
                            </span>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <LeadStatusBadge status={lead.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteTarget(lead)}
                          title="Delete saved lead"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  Delete saved lead?
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {deleteTarget.name} will be archived with a deletion timestamp.
                  It can be restored later from the archived lead workflow.
                </p>
              </div>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-200"
                onClick={() => setDeleteTarget(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={deleting}
                onClick={confirmDelete}
              >
                <Trash2 className="h-4 w-4" />
                Delete Lead
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
