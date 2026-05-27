"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CreditCard, Lock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface Profile {
  id: string;
  fullName: string | null;
  email: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  role: string;
  commissionRate: number;
  accountStatus: string;
  notes: string | null;
  bio: string | null;
  preferredPayoutMethod: string | null;
  cashAppTag: string | null;
  paypalEmail: string | null;
  venmoHandle: string | null;
  payoutLegalName: string | null;
  payoutNotes: string | null;
  bankName: string | null;
  bankAccountType: string | null;
  bankRoutingMasked: string | null;
  bankAccountMasked: string | null;
  directDepositStatus: string;
  lastProfileUpdatedAt: string | null;
  lastLoginAt: string | null;
  _count?: {
    ownedLeads: number;
    campaigns: number;
    closedClients: number;
    commissions: number;
  };
  commissions?: Array<{ commissionAmount: number; status: string }>;
}

type Message = { kind: "success" | "error"; text: string } | null;

export function ProfileSettings({ expanded = false }: { expanded?: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [personal, setPersonal] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    avatarUrl: "",
    bio: "",
  });
  const [payout, setPayout] = useState({
    preferredPayoutMethod: "",
    cashAppTag: "",
    paypalEmail: "",
    venmoHandle: "",
    payoutLegalName: "",
    payoutNotes: "",
    bankName: "",
    bankAccountType: "CHECKING",
    routingNumber: "",
    accountNumber: "",
  });
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);

  async function load() {
    const res = await fetch("/api/auth/profile");
    const data = await res.json();
    const user = data.user as Profile | null;
    setProfile(user);
    if (user) {
      setPersonal({
        fullName: user.fullName ?? "",
        email: user.email,
        phoneNumber: user.phoneNumber ?? "",
        avatarUrl: user.avatarUrl ?? "",
        bio: user.bio ?? "",
      });
      setPayout({
        preferredPayoutMethod: user.preferredPayoutMethod ?? "",
        cashAppTag: user.cashAppTag ?? "",
        paypalEmail: user.paypalEmail ?? "",
        venmoHandle: user.venmoHandle ?? "",
        payoutLegalName: user.payoutLegalName ?? "",
        payoutNotes: user.payoutNotes ?? "",
        bankName: user.bankName ?? "",
        bankAccountType: user.bankAccountType ?? "CHECKING",
        routingNumber: "",
        accountNumber: "",
      });
    }
  }

  useEffect(() => {
    load().catch(() => setProfile(null));
  }, []);

  const initials = useMemo(() => {
    const source = profile?.fullName || profile?.email || "?";
    return source
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [profile]);

  const commissionEarned = (profile?.commissions ?? [])
    .filter((commission) => commission.status !== "VOIDED")
    .reduce((sum, commission) => sum + commission.commissionAmount, 0);
  const payoutsPaid = (profile?.commissions ?? [])
    .filter((commission) => commission.status === "PAID")
    .reduce((sum, commission) => sum + commission.commissionAmount, 0);

  async function saveProfile(payload: Record<string, unknown>, section: string) {
    setMessage(null);
    setSavingSection(section);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingSection(null);
    const data = await res.json();
    if (!res.ok) {
      setMessage({ kind: "error", text: data.error ?? "Save failed" });
      return;
    }
    setMessage({ kind: "success", text: "Profile updated." });
    setProfile(data.user);
    await load();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (password.newPassword !== password.confirmPassword) {
      setMessage({ kind: "error", text: "New password and confirmation do not match." });
      return;
    }
    setSavingSection("password");
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      }),
    });
    setSavingSection(null);
    const data = await res.json();
    if (!res.ok) {
      setMessage({ kind: "error", text: data.error ?? "Password update failed" });
      return;
    }
    setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setMessage({ kind: "success", text: "Password updated." });
  }

  if (!profile) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-sm text-slate-500">
          Loading profile...
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={
            message.kind === "success"
              ? "rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300"
              : "rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300"
          }
        >
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader title="Personal Information" />
        <CardBody>
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-purple-500/30 bg-purple-600/20 text-lg font-bold text-purple-200">
              {personal.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={personal.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-100">{profile.fullName ?? profile.email}</p>
              <p className="text-sm text-slate-500">{profile.email}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name" id="fullName">
              <Input
                id="fullName"
                value={personal.fullName}
                onChange={(e) => setPersonal((prev) => ({ ...prev, fullName: e.target.value }))}
              />
            </Field>
            <Field label="Email address" id="email">
              <Input
                id="email"
                type="email"
                value={personal.email}
                onChange={(e) => setPersonal((prev) => ({ ...prev, email: e.target.value }))}
              />
            </Field>
            <Field label="Phone number" id="phoneNumber">
              <Input
                id="phoneNumber"
                value={personal.phoneNumber}
                onChange={(e) => setPersonal((prev) => ({ ...prev, phoneNumber: e.target.value }))}
              />
            </Field>
            <Field label="Avatar URL" id="avatarUrl">
              <Input
                id="avatarUrl"
                value={personal.avatarUrl}
                onChange={(e) => setPersonal((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                placeholder="https://..."
              />
            </Field>
            <div className="md:col-span-2">
              <Label htmlFor="bio">Notes / bio</Label>
              <Textarea
                id="bio"
                value={personal.bio}
                onChange={(e) => setPersonal((prev) => ({ ...prev, bio: e.target.value }))}
              />
            </div>
          </div>
          <Button
            type="button"
            className="mt-4"
            loading={savingSection === "personal"}
            onClick={() => saveProfile(personal, "personal")}
          >
            <Save className="h-4 w-4" />
            Save Personal Info
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Account Information" />
        <CardBody>
          <div className="grid gap-4 md:grid-cols-4">
            <Stat label="Role" value={profile.role.replace(/_/g, " ")} />
            <Stat label="Status" value={profile.accountStatus} />
            <Stat label="Commission" value={`${(profile.commissionRate * 100).toFixed(0)}%`} />
            <Stat label="Last login" value={profile.lastLoginAt ? formatDate(profile.lastLoginAt) : "-"} />
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Role, commission rate, and account status are managed by SUPER_ADMIN.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Payout Settings" description="Direct deposit details are masked after saving and never returned raw to the browser" />
        <CardBody className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Preferred payout method" id="preferredPayoutMethod">
              <Select
                id="preferredPayoutMethod"
                value={payout.preferredPayoutMethod}
                onChange={(e) => setPayout((prev) => ({ ...prev, preferredPayoutMethod: e.target.value }))}
              >
                <option value="">Not selected</option>
                <option value="CASH_APP">Cash App</option>
                <option value="PAYPAL">PayPal</option>
                <option value="VENMO">Venmo</option>
                <option value="DIRECT_DEPOSIT">Direct Deposit</option>
                <option value="MANUAL_CASH">Manual Cash</option>
                <option value="CHECK">Check</option>
              </Select>
            </Field>
            <Field label="Cash App tag" id="cashAppTag">
              <Input id="cashAppTag" value={payout.cashAppTag} onChange={(e) => setPayout((prev) => ({ ...prev, cashAppTag: e.target.value }))} />
            </Field>
            <Field label="PayPal email" id="paypalEmail">
              <Input id="paypalEmail" value={payout.paypalEmail} onChange={(e) => setPayout((prev) => ({ ...prev, paypalEmail: e.target.value }))} />
            </Field>
            <Field label="Venmo handle" id="venmoHandle">
              <Input id="venmoHandle" value={payout.venmoHandle} onChange={(e) => setPayout((prev) => ({ ...prev, venmoHandle: e.target.value }))} />
            </Field>
            <Field label="Legal name" id="payoutLegalName">
              <Input id="payoutLegalName" value={payout.payoutLegalName} onChange={(e) => setPayout((prev) => ({ ...prev, payoutLegalName: e.target.value }))} />
            </Field>
            <Field label="Bank name" id="bankName">
              <Input id="bankName" value={payout.bankName} onChange={(e) => setPayout((prev) => ({ ...prev, bankName: e.target.value }))} />
            </Field>
            <Field label="Account type" id="bankAccountType">
              <Select id="bankAccountType" value={payout.bankAccountType} onChange={(e) => setPayout((prev) => ({ ...prev, bankAccountType: e.target.value }))}>
                <option value="CHECKING">Checking</option>
                <option value="SAVINGS">Savings</option>
              </Select>
            </Field>
            <Field label="Routing number" id="routingNumber">
              <Input id="routingNumber" value={payout.routingNumber} onChange={(e) => setPayout((prev) => ({ ...prev, routingNumber: e.target.value }))} placeholder={profile.bankRoutingMasked ?? "Enter to update"} />
            </Field>
            <Field label="Account number" id="accountNumber">
              <Input id="accountNumber" value={payout.accountNumber} onChange={(e) => setPayout((prev) => ({ ...prev, accountNumber: e.target.value }))} placeholder={profile.bankAccountMasked ?? "Enter to update"} />
            </Field>
            <div className="md:col-span-3">
              <Label htmlFor="payoutNotes">Payout notes</Label>
              <Textarea id="payoutNotes" value={payout.payoutNotes} onChange={(e) => setPayout((prev) => ({ ...prev, payoutNotes: e.target.value }))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="slate">Direct deposit: {profile.directDepositStatus.replace(/_/g, " ")}</Badge>
            {profile.bankRoutingMasked && <Badge variant="slate">Routing {profile.bankRoutingMasked}</Badge>}
            {profile.bankAccountMasked && <Badge variant="slate">Account {profile.bankAccountMasked}</Badge>}
          </div>
          <Button
            type="button"
            loading={savingSection === "payout"}
            onClick={() => {
              if (!confirm("Update payout information? Direct deposit values will be stored securely and masked after saving.")) return;
              saveProfile(payout, "payout");
            }}
          >
            <CreditCard className="h-4 w-4" />
            Save Payout Settings
          </Button>
        </CardBody>
      </Card>

      {expanded && (
        <Card>
          <CardHeader title="Security / Change Password" />
          <CardBody>
            <form onSubmit={savePassword} className="grid gap-4 md:grid-cols-3">
              <Field label="Current password" id="currentPassword">
                <Input id="currentPassword" type="password" value={password.currentPassword} onChange={(e) => setPassword((prev) => ({ ...prev, currentPassword: e.target.value }))} required />
              </Field>
              <Field label="New password" id="newPassword">
                <Input id="newPassword" type="password" value={password.newPassword} onChange={(e) => setPassword((prev) => ({ ...prev, newPassword: e.target.value }))} required />
              </Field>
              <Field label="Confirm password" id="confirmPassword">
                <Input id="confirmPassword" type="password" value={password.confirmPassword} onChange={(e) => setPassword((prev) => ({ ...prev, confirmPassword: e.target.value }))} required />
              </Field>
              <div className="md:col-span-3">
                <Button type="submit" loading={savingSection === "password"}>
                  <Lock className="h-4 w-4" />
                  Change Password
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Activity Summary" />
        <CardBody>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="Leads saved" value={profile._count?.ownedLeads ?? 0} />
            <Stat label="Campaigns" value={profile._count?.campaigns ?? 0} />
            <Stat label="Clients closed" value={profile._count?.closedClients ?? 0} />
            <Stat label="Commissions" value={`$${commissionEarned.toLocaleString()}`} />
            <Stat label="Payouts paid" value={`$${payoutsPaid.toLocaleString()}`} />
            <Stat label="Updated" value={profile.lastProfileUpdatedAt ? formatDate(profile.lastProfileUpdatedAt) : "-"} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}
