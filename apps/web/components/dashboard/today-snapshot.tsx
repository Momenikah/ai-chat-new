"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  Inbox,
  MessageSquare,
  Plug,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import type { DashboardOverview } from "@aichat/shared";
import { formatNumber } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface TodaySnapshotProps {
  data: DashboardOverview;
}

interface SnapshotCell {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  accent: string;
}

export function TodaySnapshot({ data }: TodaySnapshotProps) {
  const todayMessages = useMemo(
    () => data.hourly_activity.reduce((sum, h) => sum + h.total, 0),
    [data.hourly_activity],
  );

  const cells: SnapshotCell[] = [
    {
      label: "Pesan hari ini",
      value: formatNumber(todayMessages),
      icon: MessageSquare,
      hint: "24 jam terakhir lintas channel",
      accent: "bg-zinc-900 text-white",
    },
    {
      label: "Resolved hari ini",
      value: formatNumber(data.resolved_today),
      icon: Inbox,
      hint:
        data.pending_conversations > 0
          ? `${formatNumber(data.pending_conversations)} menunggu follow-up`
          : "Inbox bersih",
      accent: "bg-emerald-500 text-white",
    },
    {
      label: "Agent aktif",
      value: formatNumber(data.active_agents),
      icon: UserCheck,
      hint: "Login aktif saat ini",
      accent: "bg-blue-500 text-white",
    },
    {
      label: "Channel aktif",
      value: formatNumber(data.connected_channels),
      icon: Plug,
      hint:
        data.connected_channels === 0
          ? "Hubungkan minimal 1 channel"
          : "Terkoneksi & menerima",
      accent: "bg-amber-500 text-white",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-zinc-50/60 px-5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">
              Snapshot hari ini
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <div className="grid divide-x divide-border sm:grid-cols-2 lg:grid-cols-4">
          {cells.map((cell, i) => (
            <SnapshotItem key={cell.label} cell={cell} index={i} />
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

function SnapshotItem({
  cell,
  index,
}: {
  cell: SnapshotCell;
  index: number;
}) {
  const Icon = cell.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      className="flex items-start gap-3 p-4"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cell.accent}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{cell.label}</p>
        <p className="mt-0.5 text-xl font-semibold tracking-tight">
          {cell.value}
        </p>
        {cell.hint && (
          <p className="mt-0.5 text-xs text-muted-foreground">{cell.hint}</p>
        )}
      </div>
    </motion.div>
  );
}
