"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Mail,
  MapPin,
  Phone,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Label, Select, Textarea } from "@/components/ui/input";
import {
  LeadScoreBadge,
  LeadStatusBadge,
  WebsiteStatusBadge,
} from "@/components/lead-badges";
import { formatDate } from "@/lib/utils";
import { WebsiteStatus } from "@prisma/client";

interface LeadDetail {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  websiteStatus: WebsiteStatus;
  leadScore: number;
  notes: string | null;
  status: string;
  websiteAudits: Array<{
    id: string;
    hasWebsite: boolean;
    isBroken: boolean;
    isHttps: boolean | null;
    isFacebookOnly: boolean;
    homepageTitle: string | null;
    responseStatus: number | null;
    loadTimeMs: number | null;
    notes: string | null;
    createdAt: string;
  }>;
  outreachDrafts: Array<{
    id: string;
    subject: string | null;
    message: string;
    channel: string;
    status: string;
    updatedAt: string;
  }>;
}

export function LeadDetailClient({ id }: { id: string }) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function loadLead() {
    setLoading(true);
    const res = await fetch(`/api/leads/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load");
      setLoading(false);
      return;
    }
    setLead(data.lead);
    setNotes(data.lead.notes ?? "");
    setStatus(data.lead.status);
    setError(null);
    setLoading(false);
  }

  useEffect(() => {
    loadLead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveUpdates() {
    setSaving(true);
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, status }),
    });
    if (res.ok) await loadLead();
    setSaving(false);
  }

  async function reaudit() {
    if (!lead) return;
    setAuditing(true);
    const res = await fetch("/api/audit-website", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        websiteUrl: lead.websiteUrl,
        businessLeadId: lead.id,
      }),
    });
    if (res.ok) await loadLead();
    else {
      const data = await res.json();
      alert(data.error ?? "Audit failed");
    }
    setAuditing(false);
  }

  async function generateDraft() {
    setGenerating(true);
    const res = await fetch("/api/generate-outreach-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessLeadId: id, save: true }),
    });
    if (res.ok) await loadLead();
    else {
      const data = await res.json();
      alert(data.error ?? "Failed to generate draft");
    }
    setGenerating(false);
  }

  if (loading) {
    return <p className="text-slate-500 py-12 text-center">Loading lead…</p>;
  }

  if (error || !lead) {
    return (
      <div className="text-center py-12">
        <p className="text-red-300">{error ?? "Lead not found"}</p>
        <Link href="/leads" className="text-purple-400 text-sm mt-4 inline-block">
          ← Back to leads
        </Link>
      </div>
    );
  }

  const latestAudit = lead.websiteAudits[0];

  return (
    <div className="space-y-6">
      <Link
        href="/leads"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-purple-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Saved Leads
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">{lead.name}</h1>
          <p className="mt-1 text-slate-400">{lead.category}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LeadScoreBadge score={lead.leadScore} />
            <WebsiteStatusBadge status={lead.websiteStatus} />
            <LeadStatusBadge status={lead.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" loading={auditing} onClick={reaudit}>
            <RefreshCw className="h-4 w-4" />
            Re-audit Website
          </Button>
          <Button loading={generating} onClick={generateDraft}>
            <Mail className="h-4 w-4" />
            Generate Outreach
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Business Info" />
          <CardBody className="space-y-3 text-sm">
            {lead.address && (
              <p className="flex items-start gap-2 text-slate-300">
                <MapPin className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
                {lead.address}
              </p>
            )}
            {lead.phone && (
              <p className="flex items-center gap-2 text-slate-300">
                <Phone className="h-4 w-4 text-slate-500" />
                <a href={`tel:${lead.phone}`} className="hover:text-purple-300">
                  {lead.phone}
                </a>
              </p>
            )}
            {lead.rating != null && (
              <p className="flex items-center gap-2 text-slate-300">
                <Star className="h-4 w-4 text-amber-400" />
                {lead.rating.toFixed(1)} ({lead.reviewCount ?? 0} reviews)
              </p>
            )}
            {lead.websiteUrl ? (
              <a
                href={lead.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-purple-300 hover:text-purple-200"
              >
                <ExternalLink className="h-4 w-4" />
                {lead.websiteUrl}
              </a>
            ) : (
              <p className="text-slate-500">No website on file</p>
            )}
            {lead.googleMapsUrl && (
              <a
                href={lead.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-400 hover:text-purple-300"
              >
                View on Google Maps →
              </a>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Pipeline" />
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {[
                  "NEW",
                  "SAVED",
                  "CONTACTED",
                  "INTERESTED",
                  "NOT_INTERESTED",
                  "CLIENT",
                  "ARCHIVED",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Call notes, follow-up dates…"
              />
            </div>
            <Button loading={saving} onClick={saveUpdates}>
              Save Changes
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Website Audit" description="Latest automated check" />
        <CardBody>
          {!latestAudit ? (
            <p className="text-slate-500 text-sm">
              No audit on file. Click Re-audit Website to run a check.
            </p>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-slate-500">Has website</dt>
                <dd className="text-slate-200">{latestAudit.hasWebsite ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">HTTPS</dt>
                <dd className="text-slate-200">
                  {latestAudit.isHttps == null ? "—" : latestAudit.isHttps ? "Yes" : "No"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Broken</dt>
                <dd className="text-slate-200">{latestAudit.isBroken ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Facebook only</dt>
                <dd className="text-slate-200">
                  {latestAudit.isFacebookOnly ? "Yes" : "No"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">HTTP status</dt>
                <dd className="text-slate-200">{latestAudit.responseStatus ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Load time</dt>
                <dd className="text-slate-200">
                  {latestAudit.loadTimeMs != null
                    ? `${latestAudit.loadTimeMs}ms`
                    : "—"}
                </dd>
              </div>
              {latestAudit.homepageTitle && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Page title</dt>
                  <dd className="text-slate-200">{latestAudit.homepageTitle}</dd>
                </div>
              )}
              {latestAudit.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Notes</dt>
                  <dd className="text-slate-400">{latestAudit.notes}</dd>
                </div>
              )}
              <div className="sm:col-span-2 text-xs text-slate-600">
                Audited {formatDate(latestAudit.createdAt)}
              </div>
            </dl>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Outreach Drafts"
          description="Placeholder templates — OpenAI integration coming later"
        />
        <CardBody className="space-y-4">
          {lead.outreachDrafts.length === 0 ? (
            <p className="text-slate-500 text-sm">
              No drafts yet. Click Generate Outreach to create one.
            </p>
          ) : (
            lead.outreachDrafts.map((draft) => (
              <div
                key={draft.id}
                className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="font-medium text-slate-200">
                    {draft.subject ?? "Outreach"}
                  </p>
                  <span className="text-xs text-slate-500">
                    {draft.channel} · {draft.status} · {formatDate(draft.updatedAt)}
                  </span>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-slate-400 font-sans">
                  {draft.message}
                </pre>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
