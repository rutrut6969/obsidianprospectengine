import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "purple",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: "purple" | "green" | "amber";
}) {
  const accents = {
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    green: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  };

  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl border",
            accents[accent]
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-3xl font-bold text-slate-100">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}
