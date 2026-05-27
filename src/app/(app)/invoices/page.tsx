import { SalesDashboard } from "@/components/sales/sales-dashboard";

export default function InvoicesPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-purple-400">Billing</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-100">Invoices</h1>
        <p className="mt-2 text-slate-400">
          Create invoice drafts, store Square IDs, and activate clients when invoices are paid.
        </p>
      </div>
      <SalesDashboard view="invoices" />
    </div>
  );
}
