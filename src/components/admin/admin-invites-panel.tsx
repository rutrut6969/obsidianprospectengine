"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Mail, UserPlus } from "lucide-react";

interface InviteRow {
  id: string;
  email: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

interface UserRow {
  id: string;
  email: string;
  role: string;
  isAuthorized: boolean;
  createdAt: string;
}

export function AdminInvitesPanel() {
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invite failed");
      setSuccess(`Invite sent to ${email}`);
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Invite team member"
          description="They'll receive an email via Resend to authorize and set a password"
        />
        <CardBody>
          <form onSubmit={sendInvite} className="flex flex-wrap gap-3 items-end">
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
            <Button type="submit" loading={sending}>
              <UserPlus className="h-4 w-4" />
              Send invite
            </Button>
          </form>
          {error && (
            <p className="mt-3 text-sm text-red-300">{error}</p>
          )}
          {success && (
            <p className="mt-3 text-sm text-emerald-400">{success}</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Authorized users" />
        <CardBody className="p-0">
          {loading ? (
            <p className="p-6 text-slate-500 text-sm">Loading…</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Added</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-800/50">
                    <td className="px-6 py-3 text-slate-200">{u.email}</td>
                    <td className="px-6 py-3">
                      <Badge variant={u.role === "SUPER_ADMIN" ? "purple" : "slate"}>
                        {u.role.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-6 py-3">
                      <Badge variant={u.isAuthorized ? "green" : "amber"}>
                        {u.isAuthorized ? "Authorized" : "Pending"}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-slate-500">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          )}
        </CardBody>
      </Card>
    </div>
  );
}
