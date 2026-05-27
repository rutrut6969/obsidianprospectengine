"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

interface ClientRow {
  id: string;
  businessName: string;
  contactEmail: string | null;
  upfrontWebsitePrice: number;
  retainerAmount: number;
  status: string;
  paymentStatus: string;
  owner: { fullName: string | null; email: string } | null;
}

interface CommissionRow {
  id: string;
  saleAmount: number;
  commissionAmount: number;
  status: string;
  user: { fullName: string | null; email: string };
  client: { businessName: string } | null;
}

interface InvoiceRow {
  id: string;
  title: string;
  amountDue: number;
  status: string;
  invoiceUrl: string | null;
  client: { businessName: string } | null;
}

export function SalesDashboard({ view }: { view: "clients" | "commissions" | "invoices" }) {
  const [rows, setRows] = useState<Array<ClientRow | CommissionRow | InvoiceRow>>([]);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");

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
        status: "PROSPECT",
      }),
    });
    if (!res.ok) alert((await res.json()).error ?? "Create failed");
    setBusinessName("");
    setAmount("");
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
            <form onSubmit={createClient} className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="businessName">Business</Label>
                <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="amount">Upfront price</Label>
                <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button type="submit">Create Client</Button>
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
                <Button type="submit">Create Draft</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title={view === "clients" ? "Clients" : view === "commissions" ? "Commissions" : "Invoices"} />
        <CardBody className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-slate-400">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Owner</th>
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
                        <Badge variant="slate">{"paymentStatus" in row ? row.paymentStatus : row.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {"owner" in row
                          ? row.owner?.fullName ?? row.owner?.email ?? "-"
                          : "user" in row
                            ? row.user.fullName ?? row.user.email
                            : "-"}
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
