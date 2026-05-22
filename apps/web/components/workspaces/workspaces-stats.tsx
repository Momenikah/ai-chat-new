"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  Building2,
  CalendarClock,
  Crown,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { WorkspaceWithRole } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { formatNumber, formatRelativeTime } from "@/lib/utils";

export function WorkspacesStats({
  workspaces,
}: {
  workspaces: WorkspaceWithRole[];
}) {
  const stats = useMemo(() => {
    let owner = 0;
    let admin = 0;
    let latest: WorkspaceWithRole | null = null;
    for (const w of workspaces) {
      if (w.member_role === "OWNER") owner++;
      else if (w.member_role === "ADMIN") admin++;
      if (
        !latest ||
        new Date(w.created_at).getTime() > new Date(latest.created_at).getTime()
      ) {
        latest = w;
      }
    }
    return { total: workspaces.length, owner, admin, latest };
  }, [workspaces]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Cell
        index={0}
        icon={Building2}
        label="Total workspace"
        value={formatNumber(stats.total)}
        hint="Workspace yang Anda ikuti"
        accent="bg-zinc-900 text-white"
      />
      <Cell
        index={1}
        icon={Crown}
        label="Sebagai OWNER"
        value={formatNumber(stats.owner)}
        hint="Akses penuh + billing"
        accent={
          stats.owner > 0 ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-700"
        }
      />
      <Cell
        index={2}
        icon={ShieldCheck}
        label="Sebagai ADMIN"
        value={formatNumber(stats.admin)}
        hint="Kelola operasional"
        accent={
          stats.admin > 0 ? "bg-blue-500 text-white" : "bg-zinc-100 text-zinc-700"
        }
      />
      <Cell
        index={3}
        icon={CalendarClock}
        label="Terbaru"
        value={stats.latest ? truncate(stats.latest.name, 14) : "—"}
        hint={
          stats.latest ? formatRelativeTime(stats.latest.created_at) : "Belum ada"
        }
        accent="bg-emerald-500 text-white"
      />
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function Cell({
  icon: Icon,
  label,
  value,
  hint,
  accent,
  index,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  accent: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
    >
      <Card className="flex items-start gap-3 p-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate text-xl font-semibold tracking-tight">
            {value}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      </Card>
    </motion.div>
  );
}
