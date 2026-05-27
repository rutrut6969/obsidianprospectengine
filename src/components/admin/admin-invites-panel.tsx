"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Mail, RotateCcw, UserPlus } from "lucide-react";

interface InviteRow {
  id: string;
  email: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

interface UserRow {
  id: string;
  fullName: string | null;
  email: string;
  phoneNumber: string | null;
  role: string;
  commissionRate: number;
  accountStatus: string;
  notes: string | null;
  isAuthorized: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  _count?: {
    ownedLeads: number;
    campaigns: number;
    outreachLogs: number;
    closedClients: number;
    commissions: number;
  };
  commissions?: Array<{ commissionAmount: number; status: string }>;
}

export function AdminInvitesPanel() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [commissionRate, setCommissionRate] = useState("0.1");
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/invites");
    const data = await res.json();
    if (res.ok) {
      setInvites(data.invites ?? []);
      setUsers(data.users ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSending(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fullName,
          phoneNumber,
          commissionRate: Number(commissionRate),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invite failed");
      if (data.emailSent) {
        setSuccess(`Invite sent to ${email}`);
      } else {
        setSuccess(`Invite created for ${email}, but the email was not sent. Setup link: ${data.invite?.inviteUrl ?? "unavailable"}`);
        setError(data.emailError ?? "Resend did not send the invite email.");
      }
      setEmail("");
      setFullName("");
      setPhoneNumber("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setSending(false);
    }
  }

  async function updateUser(user: UserRow, patch: Partial<UserRow>) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "User update failed");
      return;
    }
    await load();
  }

  async function resetPassword(user: UserRow) {
    const res = await fetch(`/api/admin/users/${user.id}/password-reset`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Password reset failed");
      return;
    }
    window.prompt("Password reset link", data.resetUrl);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Invite team member"
          description="They'll receive an email via Resend to authorize and set a password"
        />
        <CardBody>
          <form onSubmit={sendInvite} className="grid gap-3 md:grid-cols-5">
            <div>
              <Label htmlFor="invite-name">Full name</Label>
              <Input
                id="invite-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[220px]">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@obsidian-systems.tech"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="invite-phone">Phone</Label>
              <Input
                id="invite-phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invite-commission">Commission</Label>
              <Input
                id="invite-commission"
                type="number"
                step="0.01"
                min="0"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
              />
            </div>
            <Button type="submit" loading={sending} className="w-full self-end md:w-auto">
              <UserPlus className="h-4 w-4" />
              Send invite
            </Button>
          </form>
          {error && (
            <p className="mt-3 break-words text-sm text-red-300">{error}</p>
          )}
          {success && (
            <p className="mt-3 break-words text-sm text-emerald-400">{success}</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Authorized users" />
        <CardBody className="p-0">
          {loading ? (
            <p className="p-6 text-slate-500 text-sm">Loading…</p>
          ) : (
            <>
            <div className="space-y-3 p-4 md:hidden">
              {users.map((u) => (
                <div key={u.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-200">{u.fullName ?? u.email}</p>
                      <p className="truncate text-xs text-slate-500">{u.email}</p>
                    </div>
                    <Badge variant={u.accountStatus === "SUSPENDED" ? "red" : u.isAuthorized ? "green" : "amber"}>
                      {u.accountStatus}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={u.role === "SUPER_ADMIN" ? "purple" : "slate"}>
                      {u.role.replace("_", " ")}
                    </Badge>
                    <Badge variant="slate">{(u.commissionRate * 100).toFixed(0)}%</Badge>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">
                    {u._count?.ownedLeads ?? 0} leads | {u._count?.campaigns ?? 0} campaigns | {u._count?.outreachLogs ?? 0} sent | {u._count?.closedClients ?? 0} closed | $
                    {(u.commissions ?? [])
                      .filter((commission) => commission.status !== "VOIDED")
                      .reduce((sum, commission) => sum + commission.commissionAmount, 0)
                      .toLocaleString()} earned
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant={u.accountStatus === "SUSPENDED" ? "success" : "danger"}
                      onClick={() =>
                        updateUser(u, {
                          accountStatus:
                            u.accountStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                        } as Partial<UserRow>)
                      }
                    >
                      {u.accountStatus === "SUSPENDED" ? "Reactivate" : "Suspend"}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => resetPassword(u)}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Stats</th>
                  <th className="px-6 py-3">Commission</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-800/50">
                    <td className="px-6 py-3 text-slate-200">
                      <p className="font-medium">{u.fullName ?? u.email}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="px-6 py-3">
                      <Badge variant={u.role === "SUPER_ADMIN" ? "purple" : "slate"}>
                        {u.role.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-6 py-3">
                      <Badge variant={u.accountStatus === "SUSPENDED" ? "red" : u.isAuthorized ? "green" : "amber"}>
                        {u.accountStatus}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-slate-500">
                      {u._count?.ownedLeads ?? 0} leads | {u._count?.campaigns ?? 0} campaigns | {u._count?.outreachLogs ?? 0} sent | {u._count?.closedClients ?? 0} closed | $
                      {(u.commissions ?? [])
                        .filter((commission) => commission.status !== "VOIDED")
                        .reduce((sum, commission) => sum + commission.commissionAmount, 0)
                        .toLocaleString()} earned
                    </td>
                    <td className="px-6 py-3 text-slate-300">
                      {(u.commissionRate * 100).toFixed(0)}%
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={u.accountStatus === "SUSPENDED" ? "success" : "danger"}
                          onClick={() =>
                            updateUser(u, {
                              accountStatus:
                                u.accountStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                            } as Partial<UserRow>)
                          }
                        >
                          {u.accountStatus === "SUSPENDED" ? "Reactivate" : "Suspend"}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => resetPassword(u)}>
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reset
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Recent invites" />
        <CardBody className="p-0">
          {invites.length === 0 ? (
            <p className="p-6 text-slate-500 text-sm flex items-center gap-2">
              <Mail className="h-4 w-4" /> No invites sent yet.
            </p>
          ) : (
            <>
            <div className="space-y-3 p-4 md:hidden">
              {invites.map((inv) => (
                <div key={inv.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-sm font-medium text-slate-200">{inv.email}</p>
                    <Badge variant={inv.usedAt ? "green" : "amber"}>
                      {inv.usedAt ? "Accepted" : "Pending"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-1 text-sm text-slate-500">
                    <p>Expires: {formatDate(inv.expiresAt)}</p>
                    <p>Sent: {formatDate(inv.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Expires</th>
                  <th className="px-6 py-3">Sent</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-800/50">
                    <td className="px-6 py-3 text-slate-200">{inv.email}</td>
                    <td className="px-6 py-3">
                      <Badge variant={inv.usedAt ? "green" : "amber"}>
                        {inv.usedAt ? "Accepted" : "Pending"}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-slate-500">{formatDate(inv.expiresAt)}</td>
                    <td className="px-6 py-3 text-slate-500">{formatDate(inv.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
