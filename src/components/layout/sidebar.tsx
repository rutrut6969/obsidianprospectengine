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
  Menu,
  X,
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

const adminNav = [
  { href: "/admin/outreach", label: "Approvals", icon: ClipboardCheck },
  { href: "/admin/templates", label: "Templates", icon: FileText },
  { href: "/admin/invites", label: "Team Access", icon: UserPlus },
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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMobileOpen(false);
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
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-800 bg-[#0a0a0f]/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-200"
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="flex min-w-0 items-center gap-2" onClick={() => setMobileOpen(false)}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-600/20">
            <Gem className="h-4 w-4 text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-purple-400">
              Obsidian
            </p>
            <p className="truncate text-sm font-bold leading-tight text-slate-100">
              Prospect Engine
            </p>
          </div>
        </Link>
        <ProfileButton user={user} initials={initials} compact />
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close navigation menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex h-full w-[min(22rem,86vw)] flex-col border-r border-slate-800 bg-[#0a0a0f] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
              <Brand />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-300"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList
              pathname={pathname}
              isSuperAdmin={isSuperAdmin}
              onNavigate={() => setMobileOpen(false)}
            />
            <SidebarFooter
              user={user}
              initials={initials}
              onLogout={logout}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-800 bg-black/40 lg:flex">
        <div className="border-b border-slate-800 px-5 py-5">
          <Brand />
        </div>

        <NavList pathname={pathname} isSuperAdmin={isSuperAdmin} />

        <SidebarFooter user={user} initials={initials} onLogout={logout} />
      </aside>
    </>
  );
}

function Brand() {
  return (
    <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/20 border border-purple-500/30">
          <Gem className="h-5 w-5 text-purple-400" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-purple-400">
            Obsidian
          </p>
          <h1 className="text-sm font-bold text-slate-100 leading-tight">
            Prospect Engine
          </h1>
        </div>
      </div>
  );
}

function NavList({
  pathname,
  isSuperAdmin,
  onNavigate,
}: {
  pathname: string;
  isSuperAdmin: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
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
            {adminNav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname.startsWith(href)
                    ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>
  );
}

function SidebarFooter({
  user,
  initials,
  onLogout,
  onNavigate,
}: {
  user: SessionUser | null;
  initials: string;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-3 border-t border-slate-800 p-4">
        <ProfileButton user={user} initials={initials} onClick={onNavigate} />
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
        <p className="text-xs text-slate-600">Obsidian Systems LLC</p>
      </div>
  );
}

function ProfileButton({
  user,
  initials,
  compact,
  onClick,
}: {
  user: SessionUser | null;
  initials: string;
  compact?: boolean;
  onClick?: () => void;
}) {
  if (!user) {
    return compact ? (
      <div className="h-11 w-11 rounded-lg border border-slate-800 bg-slate-950" />
    ) : null;
  }

  return (
    <Link
      href="/profile"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-2 transition-colors hover:border-purple-500/40 hover:bg-slate-900",
        compact && "h-11 w-11 justify-center p-0"
      )}
      aria-label="Open profile settings"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-purple-500/30 bg-purple-600/20 text-sm font-bold text-purple-200">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-100">
            {user.fullName || "Profile"}
          </p>
          <p className="truncate text-xs text-slate-500" title={user.email}>
            {user.email}
          </p>
        </div>
      )}
    </Link>
  );
}
