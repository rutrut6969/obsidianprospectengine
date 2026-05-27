import { SalesDashboard } from "@/components/sales/sales-dashboard";

export default function ClientsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-purple-400">Sales</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-100">Clients</h1>
        <p className="mt-2 text-slate-400">
          Track prospects, active clients, packages, retainers, and payment status.
        </p>
      </div>
      <SalesDashboard view="clients" />
    </div>
  );
}
