"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Mail,
  MapPin,
  Phone,
  Star,
  MessageSquare,
  AtSign,
  BriefcaseBusiness,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Label, Select, Textarea } from "@/components/ui/input";
import {
  LeadScoreBadge,
  LeadStatusBadge,
  WebsiteStatusBadge,
} from "@/components/lead-badges";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { WebsiteStatus } from "@prisma/client";

interface LeadDetail {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  primaryEmail: string | null;
  emailDiscoveryStatus: string;
  emailConfidence: number | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  websiteStatus: WebsiteStatus;
  leadScore: number;
  notes: string | null;
  status: string;
  ownerId: string | null;
  visibility: "GLOBAL" | "PRIVATE";
  ownershipKind: "MY_LEAD" | "GLOBAL" | "PRIVATE";
  isMine: boolean;
  isGlobal: boolean;
  isAdminLead: boolean;
  canManage: boolean;
  owner: { fullName: string | null; email: string; role: string } | null;
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
    mobileFriendly: boolean | null;
    pageSpeedScore: number | null;
    professionalismScore: number | null;
    summary: string | null;
    weaknesses: string[];
    improvements: string[];
    conversionOpportunityScore: number | null;
    createdAt: string;
  }>;
  outreachDrafts: Array<{
    id: string;
    subject: string | null;
    message: string;
    channel: string;
    status: string;
    aiProvider: string | null;
    aiScore: number | null;
    updatedAt: string;
  }>;
  activities: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    createdAt: string;
  }>;
  contactMethods: Array<{
    id: string;
    type: string;
    value: string;
    confidence: number | null;
    sourceUrl: string | null;
    isPrimary: boolean;
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
  const [discoveringEmail, setDiscoveringEmail] = useState(false);
  const [converting, setConverting] = useState(false);
  const [draftChannel, setDraftChannel] = useState("EMAIL");

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
      body: JSON.stringify({ businessLeadId: id, save: true, channel: draftChannel }),
    });
    if (res.ok) await loadLead();
    else {
      const data = await res.json();
      alert(data.error ?? "Failed to generate draft");
    }
    setGenerating(false);
  }

  async function discoverEmail() {
    setDiscoveringEmail(true);
    const res = await fetch(`/api/leads/${id}/discover-email`, { method: "POST" });
    setDiscoveringEmail(false);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Email discovery failed");
      return;
    }
    await loadLead();
  }

  async function convertToClient() {
    if (!lead) return;
    if (!confirm(`Convert ${lead.name} into a client record?`)) return;
    setConverting(true);
    const res = await fetch(`/api/leads/${id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overrideDuplicate: false }),
    });
    setConverting(false);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Lead conversion failed");
      return;
    }
    window.location.assign("/clients");
  }

  if (loading) {
    return <p className="py-12 text-center text-slate-500">Loading lead...</p>;
  }

  if (error || !lead) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-300">{error ?? "Lead not found"}</p>
        <Link href="/leads" className="mt-4 inline-block text-sm text-purple-400">
          Back to leads
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
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold text-slate-100 sm:text-3xl">{lead.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {lead.category && <Badge variant="purple">{lead.category}</Badge>}
            <OwnershipBadges lead={lead} />
            <LeadScoreBadge score={lead.leadScore} />
            <WebsiteStatusBadge status={lead.websiteStatus} />
            <LeadStatusBadge status={lead.status} />
          </div>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2 lg:flex lg:flex-wrap">
          <Select
            value={draftChannel}
            onChange={(e) => setDraftChannel(e.target.value)}
            className="w-full sm:w-36"
            aria-label="Outreach channel"
          >
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
            <option value="FACEBOOK">Facebook</option>
          </Select>
          <Button variant="secondary" loading={auditing} onClick={reaudit}>
            <RefreshCw className="h-4 w-4" />
            Re-audit
          </Button>
          <Button loading={generating} onClick={generateDraft}>
            {draftChannel === "SMS" ? (
              <MessageSquare className="h-4 w-4" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Generate Draft
          </Button>
          <Button variant="secondary" loading={discoveringEmail} onClick={discoverEmail}>
            <AtSign className="h-4 w-4" />
            Find Email
          </Button>
          <Button
            variant="success"
            loading={converting}
            onClick={convertToClient}
            disabled={lead.status === "CLIENT"}
          >
            <BriefcaseBusiness className="h-4 w-4" />
            Convert
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Business Info" />
          <CardBody className="space-y-3 text-sm">
            {lead.address && (
              <p className="flex items-start gap-2 text-slate-300">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
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
            {lead.primaryEmail && (
              <p className="flex items-center gap-2 text-slate-300">
                <AtSign className="h-4 w-4 text-slate-500" />
                <a href={`mailto:${lead.primaryEmail}`} className="hover:text-purple-300">
                  {lead.primaryEmail}
                </a>
                {lead.emailConfidence != null && (
                  <span className="text-xs text-slate-500">
                    {lead.emailConfidence}% confidence
                  </span>
                )}
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
                View on Google Maps
              </a>
            )}
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-xs uppercase text-slate-500">Ownership</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <OwnershipBadges lead={lead} />
              </div>
              <p className="mt-2 break-words text-sm text-slate-400">
                Owner: {lead.isMine ? "Me" : lead.owner?.fullName ?? lead.owner?.email ?? (lead.isGlobal ? "Obsidian Systems" : "-")}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-xs uppercase text-slate-500">Email discovery</p>
              <p className="mt-1 text-slate-300">{lead.emailDiscoveryStatus.replace(/_/g, " ")}</p>
              {lead.contactMethods.filter((method) => method.type === "EMAIL").length > 0 && (
                <div className="mt-2 space-y-1">
                  {lead.contactMethods
                    .filter((method) => method.type === "EMAIL")
                    .map((method) => (
                      <p key={method.id} className="text-xs text-slate-400">
                        {method.value} {method.confidence != null ? `(${method.confidence}%)` : ""}
                      </p>
                    ))}
                </div>
              )}
            </div>
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
                placeholder="Call notes, follow-up dates..."
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
            <p className="text-sm text-slate-500">
              No audit on file. Click Re-audit to run a check.
            </p>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Has website" value={latestAudit.hasWebsite ? "Yes" : "No"} />
              <Info
                label="HTTPS"
                value={
                  latestAudit.isHttps == null ? "-" : latestAudit.isHttps ? "Yes" : "No"
                }
              />
              <Info label="Broken" value={latestAudit.isBroken ? "Yes" : "No"} />
              <Info
                label="Facebook only"
                value={latestAudit.isFacebookOnly ? "Yes" : "No"}
              />
              <Info label="HTTP status" value={latestAudit.responseStatus ?? "-"} />
              <Info
                label="Load time"
                value={latestAudit.loadTimeMs != null ? `${latestAudit.loadTimeMs}ms` : "-"}
              />
              <Info
                label="Mobile friendly"
                value={
                  latestAudit.mobileFriendly == null
                    ? "Review needed"
                    : latestAudit.mobileFriendly
                      ? "Likely"
                      : "Needs work"
                }
              />
              <Info label="Page speed score" value={latestAudit.pageSpeedScore ?? "-"} />
              <Info
                label="Professionalism"
                value={latestAudit.professionalismScore ?? "-"}
              />
              <Info
                label="Conversion opportunity"
                value={latestAudit.conversionOpportunityScore ?? "-"}
              />
              {latestAudit.homepageTitle && (
                <InfoWide label="Page title" value={latestAudit.homepageTitle} />
              )}
              {latestAudit.summary && <InfoWide label="Summary" value={latestAudit.summary} />}
              {latestAudit.weaknesses?.length > 0 && (
                <ListWide label="Weaknesses" items={latestAudit.weaknesses} />
              )}
              {latestAudit.improvements?.length > 0 && (
                <ListWide label="Suggested improvements" items={latestAudit.improvements} />
              )}
              {latestAudit.notes && <InfoWide label="Notes" value={latestAudit.notes} muted />}
              <div className="text-xs text-slate-600 sm:col-span-2">
                Audited {formatDate(latestAudit.createdAt)}
              </div>
            </dl>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Outreach Drafts"
          description="Drafts stay queued until a super admin approves them"
        />
        <CardBody className="space-y-4">
          {lead.outreachDrafts.length === 0 ? (
            <p className="text-sm text-slate-500">
              No drafts yet. Generate an email, SMS, or Facebook draft.
            </p>
          ) : (
            lead.outreachDrafts.map((draft) => (
              <div
                key={draft.id}
                className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-200">
                    {draft.subject ?? "Outreach"}
                  </p>
                  <span className="text-xs text-slate-500">
                    {draft.channel} | {draft.status} | {draft.aiProvider ?? "fallback"} |{" "}
                    {formatDate(draft.updatedAt)}
                  </span>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-400">
                  {draft.message}
                </pre>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="CRM History" description="Notes, status changes, and outreach activity" />
        <CardBody className="space-y-3">
          {lead.activities.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            lead.activities.map((activity) => (
              <div
                key={activity.id}
                className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-200">{activity.title}</p>
                  <span className="text-xs text-slate-500">
                    {formatDate(activity.createdAt)}
                  </span>
                </div>
                {activity.body && (
                  <p className="mt-1 text-sm text-slate-400">{activity.body}</p>
                )}
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function OwnershipBadges({ lead }: { lead: Pick<LeadDetail, "isMine" | "isGlobal" | "isAdminLead"> }) {
  if (lead.isMine) {
    return (
      <>
        <Badge variant="green">MY LEAD</Badge>
        <Badge variant="slate">PRIVATE</Badge>
      </>
    );
  }
  if (lead.isGlobal) {
    return (
      <>
        <Badge variant="purple">GLOBAL</Badge>
        <Badge variant="slate">{lead.isAdminLead ? "ADMIN LEAD" : "SHARED"}</Badge>
      </>
    );
  }
  return <Badge variant="slate">PRIVATE</Badge>;
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200">{value}</dd>
    </div>
  );
}

function InfoWide({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="sm:col-span-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className={muted ? "text-slate-400" : "text-slate-200"}>{value}</dd>
    </div>
  );
}

function ListWide({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="sm:col-span-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-400">
        <ul className="list-disc space-y-1 pl-5">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </dd>
    </div>
  );
}
