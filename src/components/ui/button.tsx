import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-purple-600 hover:bg-purple-500 text-white border border-purple-500/50 shadow-[0_0_20px_rgba(147,51,234,0.25)]",
  secondary:
    "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600",
  ghost: "bg-transparent hover:bg-slate-800 text-slate-300 border border-transparent",
  danger: "bg-red-950 hover:bg-red-900 text-red-200 border border-red-800",
  success:
    "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/50",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "sm" | "md" | "lg";
    loading?: boolean;
  }
>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, ...props },
  ref
) {
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
});
