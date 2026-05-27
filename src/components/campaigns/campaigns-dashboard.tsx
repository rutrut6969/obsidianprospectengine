"use client";

import { useEffect, useState } from "react";
import { Megaphone, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface CampaignRow {
  id: string;
  name: string;
  type: "EMAIL" | "SMS";
  status: string;
  businessCategory: string | null;
  city: string | null;
  state: string | null;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  repliedCount: number;
  bouncedCount: number;
  _count: { leads: number };
  owner: { fullName: string | null; email: string } | null;
}

export function CampaignsDashboard() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"EMAIL" | "SMS">("EMAIL");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/campaigns");
    const data = await res.json();
    setCampaigns(data.campaigns ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, businessCategory: category, notes }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Campaign create failed");
      return;
    }
    setName("");
    setCategory("");
    setNotes("");
    await load();
  }

  async function generateDrafts(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/campaigns/${id}/generate-drafts`, { method: "POST" });
    setBusyId(null);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Draft generation failed");
      return;
    }
    alert(`Generated ${data.created ?? 0} draft(s).`);
  }

  async function deleteCampaign(id: string) {
    if (!confirm("Archive this campaign?")) return;
    setBusyId(id);
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    setBusyId(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Create campaign" description="Campaigns are scoped to their owner unless you are SUPER_ADMIN" />
        <CardBody>
          <form onSubmit={createCampaign} className="grid gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="campaign-name">Name</Label>
              <Input id="campaign-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="campaign-type">Type</Label>
              <Select id="campaign-type" value={type} onChange={(e) => setType(e.target.value as "EMAIL" | "SMS")}>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="campaign-category">Category</Label>
              <Input id="campaign-category" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="md:row-span-2">
              <Label htmlFor="campaign-notes">Notes</Label>
              <Textarea id="campaign-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <Button type="submit" loading={creating}>
                <Plus className="h-4 w-4" />
                Create Campaign
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Campaigns" />
        <CardBody className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading campaigns...</p>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Megaphone className="mb-3 h-10 w-10 text-slate-600" />
              <p className="max-w-md text-sm text-slate-500">
                No campaigns yet. Create one, attach leads, generate drafts, then approve from the queue.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-slate-400">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Leads</th>
                    <th className="px-4 py-3">Analytics</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="border-b border-slate-800/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-200">{campaign.name}</p>
                        <p className="text-xs text-slate-500">{campaign.businessCategory ?? "All categories"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={campaign.type === "SMS" ? "green" : "purple"}>{campaign.type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{campaign._count.leads}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {campaign.sentCount} sent | {campaign.openedCount} opened | {campaign.clickedCount} clicked | {campaign.repliedCount} replied | {campaign.bouncedCount} bounced
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {campaign.owner?.fullName ?? campaign.owner?.email ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" loading={busyId === campaign.id} onClick={() => generateDrafts(campaign.id)}>
                            <RefreshCw className="h-3.5 w-3.5" />
                            Drafts
                          </Button>
                          <Button variant="danger" size="sm" loading={busyId === campaign.id} onClick={() => deleteCampaign(campaign.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
