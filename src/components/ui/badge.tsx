import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "purple"
  | "green"
  | "amber"
  | "red"
  | "slate"
  | "score-high"
  | "score-medium"
  | "score-low";

const variants: Record<BadgeVariant, string> = {
  default: "bg-slate-800 text-slate-200 border-slate-700",
  purple: "bg-purple-950/60 text-purple-300 border-purple-800/50",
  green: "bg-emerald-950/60 text-emerald-400 border-emerald-800/50",
  amber: "bg-amber-950/60 text-amber-300 border-amber-800/50",
  red: "bg-red-950/60 text-red-300 border-red-800/50",
  slate: "bg-slate-900 text-slate-400 border-slate-700",
  "score-high": "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 font-semibold",
  "score-medium": "bg-amber-500/15 text-amber-300 border-amber-500/40",
  "score-low": "bg-slate-700/50 text-slate-400 border-slate-600",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
