"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  AlertTriangle,
  Building2,
  MessageSquare,
  PauseCircle,
  Plug,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { PlatformOverview } from "@aichat/shared";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RevenueHero } from "@/components/admin/revenue-hero";
import { AdminQuickNav } from "@/components/admin/admin-quick-nav";
import { AuditFeed } from "@/components/admin/audit-feed";
import { GlobalSearch } from "@/components/admin/global-search";

function formatNum(n: number): string {
  return n.toLocaleString("id-ID");
}

export default function AdminOverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: api.admin.overview,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Platform Overview
        </h1>
        <p className="text-sm text-zinc-400">
          Statistik seluruh platform AI Chat.
        </p>
      </div>

      <GlobalSearch />

      {isLoading || !data ? (
        <>
          <div className="h-32 animate-pulse rounded-2xl bg-zinc-900" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-zinc-900" />
            ))}
          </div>
        </>
      ) : (
        <>
          <RevenueHero data={data} />

          {/* Platform — growth metrics */}
          <StatGroup title="Platform">
            <Stat
              icon={Building2}
              label="Workspaces"
              value={formatNum(data.total_workspaces)}
            />
            <Stat
              icon={Users}
              label="Users"
              value={formatNum(data.total_users)}
            />
            <Stat
              icon={MessageSquare}
              label="Total messages"
              value={formatNum(data.total_messages)}
            />
            <Stat
              icon={Plug}
              label="Active channels"
              value={formatNum(data.total_active_channels)}
            />
          </StatGroup>

          {/* Health — anomalies to act on */}
          <StatGroup title="Kesehatan platform">
            <Stat
              icon={PauseCircle}
              label="Suspended workspaces"
              value={formatNum(data.suspended_workspaces)}
              tone={data.suspended_workspaces > 0 ? "danger" : "muted"}
            />
            <Stat
              icon={AlertTriangle}
              label="Open reports"
              value={formatNum(data.open_reports)}
              tone={data.open_reports > 0 ? "warn" : "muted"}
            />
          </StatGroup>

          <AdminQuickNav
            counts={{
              users: data.total_users,
              workspaces: data.total_workspaces,
              channels: data.total_active_channels,
              subscriptions: data.plan_breakdown.reduce(
                (s, p) => s + p.count,
                0,
              ),
              reports: data.open_reports,
              suspended: data.suspended_workspaces,
            }}
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <PlanBreakdown data={data} />
            <RecentSignups data={data} />
            <AuditFeed />
          </div>
        </>
      )}
    </motion.div>
  );
}

function StatGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "default" | "warn" | "danger" | "muted";
}) {
  const iconTone = {
    default: "text-zinc-400",
    warn: "text-amber-400",
    danger: "text-red-400",
    muted: "text-zinc-600",
  }[tone];
  return (
    <div
      className={cn(
        "rounded-xl border bg-zinc-900 p-4",
        tone === "danger"
          ? "border-red-500/30"
          : tone === "warn"
            ? "border-amber-500/30"
            : "border-zinc-800",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">{label}</span>
        <Icon className={cn("h-4 w-4", iconTone)} />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function PlanBreakdown({ data }: { data: PlatformOverview }) {
  const total = data.plan_breakdown.reduce((s, p) => s + p.count, 0) || 1;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="font-semibold">Distribusi paket</h2>
      <div className="mt-4 space-y-3">
        {data.plan_breakdown.map((p) => (
          <div key={p.plan_code}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono text-zinc-300">{p.plan_code}</span>
              <span className="text-zinc-400">{p.count} subscription</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${Math.round((p.count / total) * 100)}%` }}
              />
            </div>
          </div>
        ))}
        {data.plan_breakdown.length === 0 && (
          <p className="text-sm text-zinc-500">Belum ada data paket.</p>
        )}
      </div>
    </div>
  );
}

function RecentSignups({ data }: { data: PlatformOverview }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="font-semibold">Pendaftaran terbaru</h2>
      <ul className="mt-4 space-y-2">
        {data.recent_signups.map((u) => (
          <li
            key={u.id}
            className="flex items-center justify-between text-sm"
          >
            <div className="min-w-0">
              <p className="truncate text-zinc-200">{u.name}</p>
              <p className="truncate text-xs text-zinc-500">{u.email}</p>
            </div>
            <span className="shrink-0 text-xs text-zinc-500">
              {new Date(u.created_at).toLocaleDateString("id-ID")}
            </span>
          </li>
        ))}
        {data.recent_signups.length === 0 && (
          <p className="text-sm text-zinc-500">Belum ada pendaftaran.</p>
        )}
      </ul>
    </div>
  );
}
