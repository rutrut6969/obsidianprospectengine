import { SalesDashboard } from "@/components/sales/sales-dashboard";

export default function CommissionsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-purple-400">Sales</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-100">Commissions</h1>
        <p className="mt-2 text-slate-400">
          Track pending, approved, paid, and voided commission payouts.
        </p>
      </div>
      <SalesDashboard view="commissions" />
    </div>
  );
}
