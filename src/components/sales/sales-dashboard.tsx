"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

interface ClientRow {
  id: string;
  businessName: string;
  businessCategory: string | null;
  websiteUrl: string | null;
  city: string | null;
  state: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  upfrontWebsitePrice: number;
  retainerAmount: number;
  retainerTier: string;
  status: string;
  paymentStatus: string;
  retainerPaymentStatus: string;
  lastPaymentDate: string | null;
  nextPaymentDate: string | null;
  squareCustomerId: string | null;
  squareSubscriptionId: string | null;
  latestSquareInvoiceId: string | null;
  latestSquarePaymentId: string | null;
  owner: { fullName: string | null; email: string } | null;
  closedBy: { fullName: string | null; email: string } | null;
  businessLead: { id: string; name: string; category: string | null } | null;
  invoices?: Array<{ id: string; title: string; amountDue: number; status: string; invoiceUrl: string | null }>;
  commissions?: Array<{ id: string; commissionAmount: number; status: string }>;
  paymentEvents?: Array<{
    id: string;
    type: string;
    amount: number | null;
    message: string | null;
    occurredAt: string;
  }>;
}

interface CommissionRow {
  id: string;
  saleAmount: number;
  commissionAmount: number;
  commissionRate: number;
  status: string;
  squarePaymentId: string | null;
  payoutDate: string | null;
  payoutApprovedAt: string | null;
  user: { fullName: string | null; email: string };
  client: { businessName: string } | null;
  invoice: { title: string; status: string } | null;
}

interface InvoiceRow {
  id: string;
  title: string;
  amountDue: number;
  status: string;
  invoiceUrl: string | null;
  squareInvoiceId: string | null;
  squarePaymentId: string | null;
  dueDate: string | null;
  sentAt: string | null;
  client: { businessName: string } | null;
}

export function SalesDashboard({ view }: { view: "clients" | "commissions" | "invoices" }) {
  const [rows, setRows] = useState<Array<ClientRow | CommissionRow | InvoiceRow>>([]);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [amount, setAmount] = useState("");
  const [retainerAmount, setRetainerAmount] = useState("");
  const [title, setTitle] = useState("");
  const [setupClientId, setSetupClientId] = useState<string | null>(null);
  const [setupAmount, setSetupAmount] = useState("");
  const [retainerTier, setRetainerTier] = useState("PROMO_100");
  const [customRetainerAmount, setCustomRetainerAmount] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/${view}`);
    const data = await res.json();
    setRows(data[view] ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName,
        upfrontWebsitePrice: Number(amount || 0),
        retainerAmount: Number(retainerAmount || 0),
        status: "PROSPECT",
      }),
    });
    if (!res.ok) alert((await res.json()).error ?? "Create failed");
    setBusinessName("");
    setAmount("");
    setRetainerAmount("");
    await load();
  }

  async function runBillingSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!setupClientId) return;
    setSetupBusy(true);
    setMessage(null);
    const res = await fetch(`/api/clients/${setupClientId}/billing-setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        websiteBuildAmount: Number(setupAmount || 0),
        retainerTier,
        customRetainerAmount: Number(customRetainerAmount || 0),
        sendInvoice: true,
        setupRetainer: true,
      }),
    });
    const data = await res.json();
    setSetupBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Billing setup failed");
      return;
    }
    setMessage(
      [
        data.invoiceSent ? "Invoice sent" : `Invoice not sent: ${data.invoiceError ?? "Square unavailable"}`,
        data.retainerSetup ? "retainer linked" : `retainer pending: ${data.retainerError ?? "Square unavailable"}`,
      ].join("; ")
    );
    await load();
  }

  async function sendInvoice(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/invoices/${id}/square`, { method: "POST" });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok || data.unavailable) {
      alert(data.error ?? data.reason ?? "Square invoice send failed");
      return;
    }
    await load();
  }

  async function updateCommission(id: string, status: "APPROVED" | "PAID") {
    setBusyId(id);
    const res = await fetch(`/api/commissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        payoutDate: status === "PAID" ? new Date().toISOString() : undefined,
      }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      alert(data.error ?? "Commission update failed");
      return;
    }
    await load();
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, amountDue: Number(amount || 0) }),
    });
    if (!res.ok) alert((await res.json()).error ?? "Create failed");
    setTitle("");
    setAmount("");
    await load();
  }

  return (
    <div className="space-y-6">
      {view === "clients" && (
        <Card>
          <CardHeader title="Add client/prospect" />
          <CardBody>
            <form onSubmit={createClient} className="grid gap-4 md:grid-cols-4">
              <div>
                <Label htmlFor="businessName">Business</Label>
                <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="amount">Upfront price</Label>
                <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="retainerAmount">Monthly retainer</Label>
                <Input id="retainerAmount" type="number" value={retainerAmount} onChange={(e) => setRetainerAmount(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full md:w-auto">Create Client</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {view === "invoices" && (
        <Card>
          <CardHeader title="Create invoice draft" description="Square sending stays unavailable unless Square env vars are configured" />
          <CardBody>
            <form onSubmit={createInvoice} className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="invoiceAmount">Amount due</Label>
                <Input id="invoiceAmount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full md:w-auto">Create Draft</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title={view === "clients" ? "Clients" : view === "commissions" ? "Commissions" : "Invoices"} />
        <CardBody className="p-0">
          {view === "clients" && setupClientId && (
            <div className="border-b border-slate-800 p-4 sm:p-6">
              <form onSubmit={runBillingSetup} className="grid gap-4 md:grid-cols-4">
                <div>
                  <Label htmlFor="setupAmount">Website build amount</Label>
                  <Input
                    id="setupAmount"
                    type="number"
                    min="1"
                    step="1"
                    value={setupAmount}
                    onChange={(e) => setSetupAmount(e.target.value)}
                    placeholder="3000"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="retainerTier">Retainer tier</Label>
                  <select
                    id="retainerTier"
                    value={retainerTier}
                    onChange={(e) => setRetainerTier(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                  >
                    <option value="PROMO_100">$100/mo Promo</option>
                    <option value="STANDARD_200">$200/mo Standard</option>
                    <option value="CUSTOM">Custom</option>
                    <option value="NONE">No retainer</option>
                  </select>
                </div>
                {retainerTier === "CUSTOM" && (
                  <div>
                    <Label htmlFor="customRetainerAmount">Custom retainer</Label>
                    <Input
                      id="customRetainerAmount"
                      type="number"
                      min="0"
                      value={customRetainerAmount}
                      onChange={(e) => setCustomRetainerAmount(e.target.value)}
                    />
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <Button type="submit" loading={setupBusy} className="flex-1">
                    Setup Billing
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setSetupClientId(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
              {message && <p className="mt-3 text-sm text-slate-400">{message}</p>}
            </div>
          )}
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No records yet.</p>
          ) : (
            <>
            <div className="space-y-3 p-4 md:hidden">
              {rows.map((row) => {
                const name =
                  "businessName" in row
                    ? row.businessName
                    : "title" in row
                      ? row.title
                      : row.client?.businessName ?? "Commission";
                const amount =
                  "amountDue" in row
                    ? row.amountDue
                    : "commissionAmount" in row
                      ? row.commissionAmount
                      : row.upfrontWebsitePrice;
                const owner =
                  "owner" in row
                    ? row.owner?.fullName ?? row.owner?.email ?? "-"
                    : "user" in row
                      ? row.user.fullName ?? row.user.email
                      : "-";
                return (
                  <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-200">{name}</p>
                        <p className="mt-1 text-xs text-slate-500">Owner: {owner}</p>
                      </div>
                      {"retainerPaymentStatus" in row ? (
                        <PaymentBadge status={row.retainerPaymentStatus} />
                      ) : (
                        <Badge variant="slate">
                          {String("paymentStatus" in row ? row.paymentStatus : row.status)}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-300">
                      <p><span className="text-slate-500">Amount:</span> ${amount.toLocaleString()}</p>
                      {"retainerPaymentStatus" in row && (
                        <>
                          <p><span className="text-slate-500">Retainer:</span> ${row.retainerAmount.toLocaleString()} / mo</p>
                          <p className="text-xs text-slate-500">
                            Last: {row.lastPaymentDate ? new Date(row.lastPaymentDate).toLocaleDateString() : "-"} | Next: {row.nextPaymentDate ? new Date(row.nextPaymentDate).toLocaleDateString() : "-"}
                          </p>
                        </>
                      )}
                      {"invoiceUrl" in row && row.invoiceUrl && (
                        <a href={row.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:text-purple-200">
                          View invoice
                        </a>
                      )}
                      {"businessName" in row && (
                        <>
                          <p><span className="text-slate-500">Contact:</span> {row.contactEmail ?? row.contactPhone ?? "-"}</p>
                          <p><span className="text-slate-500">Lead:</span> {row.businessLead?.name ?? "-"}</p>
                          <p><span className="text-slate-500">Square:</span> {row.squareCustomerId ?? "Not linked"}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => {
                              setSetupClientId(row.id);
                              setSetupAmount(String(row.upfrontWebsitePrice || ""));
                              setRetainerTier(row.retainerTier || "PROMO_100");
                            }}>
                              Billing
                            </Button>
                          </div>
                        </>
                      )}
                      {"amountDue" in row && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busyId === row.id}
                          onClick={() => sendInvoice(row.id)}
                          disabled={row.status === "PAID"}
                        >
                          Send Invoice
                        </Button>
                      )}
                      {"commissionAmount" in row && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="success"
                            loading={busyId === row.id}
                            onClick={() => updateCommission(row.id, "APPROVED")}
                            disabled={row.status !== "READY_TO_PAY" && row.status !== "PENDING"}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={busyId === row.id}
                            onClick={() => updateCommission(row.id, "PAID")}
                            disabled={row.status !== "APPROVED"}
                          >
                            Mark Paid
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-slate-400">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    {view === "clients" && <th className="px-4 py-3">Retainer</th>}
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800/50">
                      <td className="px-4 py-3 text-slate-200">
                        {"businessName" in row
                          ? row.businessName
                          : "title" in row
                            ? row.title
                            : row.client?.businessName ?? "Commission"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        $
                        {("amountDue" in row
                          ? row.amountDue
                          : "commissionAmount" in row
                            ? row.commissionAmount
                            : row.upfrontWebsitePrice
                        ).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {"retainerPaymentStatus" in row ? (
                          <PaymentBadge status={row.retainerPaymentStatus} />
                        ) : (
                          <Badge variant="slate">
                            {String("paymentStatus" in row ? row.paymentStatus : row.status)}
                          </Badge>
                        )}
                      </td>
                      {view === "clients" && (
                        <td className="px-4 py-3 text-slate-400">
                          {"retainerPaymentStatus" in row ? (
                            <>
                              <p>${row.retainerAmount.toLocaleString()} / mo</p>
                              <p className="text-xs text-slate-500">
                                Last: {row.lastPaymentDate ? new Date(row.lastPaymentDate).toLocaleDateString() : "-"} | Next: {row.nextPaymentDate ? new Date(row.nextPaymentDate).toLocaleDateString() : "-"}
                              </p>
                            </>
                          ) : (
                            "-"
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-slate-500">
                        {"owner" in row
                          ? row.owner?.fullName ?? row.owner?.email ?? "-"
                          : "user" in row
                            ? row.user.fullName ?? row.user.email
                            : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {"businessName" in row && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSetupClientId(row.id);
                              setSetupAmount(String(row.upfrontWebsitePrice || ""));
                              setRetainerTier(row.retainerTier || "PROMO_100");
                            }}
                          >
                            Billing
                          </Button>
                        )}
                        {"amountDue" in row && (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={busyId === row.id}
                            onClick={() => sendInvoice(row.id)}
                            disabled={row.status === "PAID"}
                          >
                            Send Invoice
                          </Button>
                        )}
                        {"commissionAmount" in row && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="success"
                              loading={busyId === row.id}
                              onClick={() => updateCommission(row.id, "APPROVED")}
                              disabled={row.status !== "READY_TO_PAY" && row.status !== "PENDING"}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={busyId === row.id}
                              onClick={() => updateCommission(row.id, "PAID")}
                              disabled={row.status !== "APPROVED"}
                            >
                              Paid
                            </Button>
                          </div>
                        )}
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
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const variant =
    status === "CURRENT"
      ? "green"
      : status === "DUE_SOON"
        ? "amber"
        : status === "OVERDUE" || status === "FAILED" || status === "CANCELED"
          ? "red"
          : "slate";
  return <Badge variant={variant}>Payment: {status.replace(/_/g, " ")}</Badge>;
}
