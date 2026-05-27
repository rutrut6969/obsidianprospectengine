"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Search,
  List,
  Users,
  Megaphone,
  Settings,
  Gem,
  UserPlus,
  LogOut,
  ClipboardCheck,
  BriefcaseBusiness,
  Receipt,
  BadgeDollarSign,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Lead Search", icon: Search },
  { href: "/results", label: "Lead Results", icon: List },
  { href: "/leads", label: "Saved Leads", icon: Users },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/clients", label: "Clients", icon: BriefcaseBusiness },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/commissions", label: "Commissions", icon: BadgeDollarSign },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SessionUser {
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  role: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const initials = (user?.fullName || user?.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-black/40">
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/20 border border-purple-500/30">
          <Gem className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-purple-400">
            Obsidian
          </p>
          <h1 className="text-sm font-bold text-slate-100 leading-tight">
            Prospect Engine
          </h1>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        {isSuperAdmin && (
          <>
            <Link
              href="/admin/outreach"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/admin/outreach")
                  ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              )}
            >
              <ClipboardCheck className="h-4 w-4 shrink-0" />
              Approvals
            </Link>
            <Link
              href="/admin/templates"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/admin/templates")
                  ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              )}
            >
              <FileText className="h-4 w-4 shrink-0" />
              Templates
            </Link>
            <Link
              href="/admin/invites"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/admin/invites")
                  ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              )}
            >
              <UserPlus className="h-4 w-4 shrink-0" />
              Team Access
            </Link>
          </>
        )}
      </nav>

      <div className="border-t border-slate-800 p-4 space-y-3">
        {user && (
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-2 transition-colors hover:border-purple-500/40 hover:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-purple-500/30 bg-purple-600/20 text-sm font-bold text-purple-200">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-100">
                {user.fullName || "Profile"}
              </p>
              <p className="truncate text-xs text-slate-500" title={user.email}>
                {user.email}
              </p>
            </div>
          </Link>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
        <p className="text-xs text-slate-600">Obsidian Systems LLC</p>
      </div>
    </aside>
  );
}
