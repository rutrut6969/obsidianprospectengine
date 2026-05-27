"use client";

import { useEffect, useState } from "react";
import { Check, Mail, MessageSquare, RefreshCw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Label, Select, Textarea, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LeadScoreBadge, WebsiteStatusBadge } from "@/components/lead-badges";
import type { WebsiteStatus } from "@prisma/client";

interface Draft {
  id: string;
  subject: string | null;
  message: string;
  channel: "EMAIL" | "SMS" | "FACEBOOK" | "PHONE";
  status: "DRAFT" | "APPROVED" | "REJECTED" | "SENT" | "FAILED";
  aiProvider: string | null;
  aiReasoning: string | null;
  aiScore: number | null;
  websiteAuditSummary: string | null;
  updatedAt: string;
  businessLead: {
    id: string;
    name: string;
    category: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    websiteUrl: string | null;
    websiteStatus: WebsiteStatus;
    leadScore: number;
    rating: number | null;
    reviewCount: number | null;
    websiteAudits: Array<{
      summary: string | null;
      weaknesses: string[];
      improvements: string[];
      conversionOpportunityScore: number | null;
    }>;
  };
}

interface Capabilities {
  resend: boolean;
  openai: boolean;
  twilio: { available: boolean; reason: string | null };
}

export function ApprovalQueue() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [status, setStatus] = useState("DRAFT");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, { subject: string; message: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadDrafts() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const res = await fetch(`/api/outreach-drafts?${params}`);
    const data = await res.json();
    setDrafts(data.drafts ?? []);
    setCapabilities(data.capabilities ?? null);
    setLoading(false);
  }

  useEffect(() => {
    loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function updateDraft(
    draft: Draft,
    action: "approve" | "reject" | "send" | "save"
  ) {
    setBusyId(draft.id);
    const edits = editing[draft.id];
    const res = await fetch(`/api/outreach-drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "save"
          ? { subject: edits?.subject ?? draft.subject, message: edits?.message ?? draft.message }
          : { action, subject: edits?.subject, message: edits?.message }
      ),
    });
    setBusyId(null);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Draft update failed");
      return;
    }
    await loadDrafts();
  }

  function currentDraft(draft: Draft) {
    return editing[draft.id] ?? { subject: draft.subject ?? "", message: draft.message };
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="grid gap-4 md:grid-cols-4">
          <div>
            <Label htmlFor="draftStatus">Draft status</Label>
            <Select id="draftStatus" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
            </Select>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm">
            <p className="text-slate-500">OpenAI</p>
            <p className={capabilities?.openai ? "text-emerald-400" : "text-slate-400"}>
              {capabilities?.openai ? "Available" : "Fallback templates active"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm">
            <p className="text-slate-500">Resend</p>
            <p className={capabilities?.resend ? "text-emerald-400" : "text-slate-400"}>
              {capabilities?.resend ? "Configured" : "Unavailable"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm">
            <p className="text-slate-500">Twilio</p>
            <p className={capabilities?.twilio.available ? "text-emerald-400" : "text-slate-400"}>
              {capabilities?.twilio.available ? "Configured" : "Unavailable"}
            </p>
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <p className="py-12 text-center text-slate-500">Loading drafts...</p>
      ) : drafts.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center text-sm text-slate-500">
            No outreach drafts match this view.
          </CardBody>
        </Card>
      ) : (
        drafts.map((draft) => {
          const edit = currentDraft(draft);
          const latestAudit = draft.businessLead.websiteAudits[0];
          return (
            <Card key={draft.id}>
              <CardHeader
                title={draft.businessLead.name}
                description={[
                  draft.businessLead.category,
                  [draft.businessLead.city, draft.businessLead.state].filter(Boolean).join(", "),
                ]
                  .filter(Boolean)
                  .join(" | ")}
              />
              <CardBody className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={draft.channel === "SMS" ? "green" : "purple"}>
                    {draft.channel === "SMS" ? (
                      <MessageSquare className="mr-1 h-3 w-3" />
                    ) : (
                      <Mail className="mr-1 h-3 w-3" />
                    )}
                    {draft.channel}
                  </Badge>
                  <Badge variant={draft.status === "APPROVED" ? "green" : draft.status === "FAILED" ? "red" : "slate"}>
                    {draft.status}
                  </Badge>
                  <WebsiteStatusBadge status={draft.businessLead.websiteStatus} />
                  <LeadScoreBadge score={draft.businessLead.leadScore} />
                  {draft.aiScore != null && <Badge variant="amber">AI score {draft.aiScore}</Badge>}
                  <Badge variant="slate">{draft.aiProvider ?? "fallback"}</Badge>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                  <div className="space-y-3">
                    {draft.channel === "EMAIL" && (
                      <div>
                        <Label htmlFor={`subject-${draft.id}`}>Subject</Label>
                        <Input
                          id={`subject-${draft.id}`}
                          value={edit.subject}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [draft.id]: { ...edit, subject: e.target.value },
                            }))
                          }
                        />
                      </div>
                    )}
                    <div>
                      <Label htmlFor={`message-${draft.id}`}>Draft message</Label>
                      <Textarea
                        id={`message-${draft.id}`}
                        className="min-h-[220px]"
                        value={edit.message}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [draft.id]: { ...edit, message: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm">
                    <div>
                      <p className="text-slate-500">AI reasoning</p>
                      <p className="mt-1 text-slate-300">{draft.aiReasoning ?? "Template-generated draft."}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Website audit summary</p>
                      <p className="mt-1 text-slate-300">
                        {draft.websiteAuditSummary ?? latestAudit?.summary ?? "No audit summary yet."}
                      </p>
                    </div>
                    {latestAudit?.weaknesses?.length > 0 && (
                      <div>
                        <p className="text-slate-500">Weaknesses</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-300">
                          {latestAudit.weaknesses.slice(0, 4).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
                  <Button
                    type="button"
                    variant="secondary"
                    loading={busyId === draft.id}
                    onClick={() => updateDraft(draft, "save")}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Save Edits
                  </Button>
                  <Button
                    type="button"
                    variant="success"
                    loading={busyId === draft.id}
                    onClick={() => updateDraft(draft, "approve")}
                    disabled={draft.status === "SENT"}
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    loading={busyId === draft.id}
                    onClick={() => updateDraft(draft, "reject")}
                    disabled={draft.status === "SENT"}
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    type="button"
                    loading={busyId === draft.id}
                    onClick={() => updateDraft(draft, "send")}
                    disabled={draft.status !== "APPROVED"}
                    title="Only approved drafts can be sent"
                  >
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );
}
