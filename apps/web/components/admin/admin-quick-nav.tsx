"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CreditCard,
  FileWarning,
  Plug,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  desc: string;
  count?: number | string;
  warn?: boolean;
}

export function AdminQuickNav({
  counts,
}: {
  counts: {
    users: number;
    workspaces: number;
    channels: number;
    subscriptions: number;
    reports: number;
    suspended: number;
  };
}) {
  const items: NavItem[] = [
    {
      href: "/admin/users",
      icon: Users,
      label: "Users",
      desc: "Akun platform & super admin",
      count: counts.users,
    },
    {
      href: "/admin/workspaces",
      icon: Building2,
      label: "Workspaces",
      desc: "Tenant + suspend",
      count: counts.workspaces,
      warn: counts.suspended > 0,
    },
    {
      href: "/admin/subscriptions",
      icon: CreditCard,
      label: "Subscriptions",
      desc: "Paket & status berlangganan",
      count: counts.subscriptions,
    },
    {
      href: "/admin/channels",
      icon: Plug,
      label: "Channels",
      desc: "WA / IG / Messenger lintas tenant",
      count: counts.channels,
    },
    {
      href: "/admin/logs",
      icon: ScrollText,
      label: "Logs",
      desc: "System, webhook, audit",
    },
    {
      href: "/admin/reports",
      icon: FileWarning,
      label: "Reports",
      desc: "Abuse / pelaporan",
      count: counts.reports,
      warn: counts.reports > 0,
    },
  ];

  return (
    <div>
      <h2 className="mb-3 font-semibold">Akses cepat</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`group flex items-center gap-3 rounded-xl border p-4 transition-colors ${
                it.warn
                  ? "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10"
                  : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800/60"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  it.warn
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-zinc-800 text-zinc-300"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-100">
                    {it.label}
                  </p>
                  {it.count !== undefined && (
                    <span
                      className={`rounded px-1.5 py-px text-[10px] font-medium ${
                        it.warn
                          ? "bg-amber-500/20 text-amber-200"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {it.count}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-zinc-500">{it.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
