"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plug,
  type LucideIcon,
} from "lucide-react";
import type { Channel } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export function ChannelsStats({ channels }: { channels: Channel[] }) {
  const stats = useMemo(() => {
    let connected = 0;
    let pending = 0;
    let error = 0;
    for (const c of channels) {
      if (c.status === "connected") connected++;
      else if (c.status === "pending") pending++;
      else if (c.status === "error") error++;
    }
    return { total: channels.length, connected, pending, error };
  }, [channels]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Cell
        index={0}
        icon={Plug}
        label="Total channel"
        value={formatNumber(stats.total)}
        hint="Terdaftar di workspace"
        accent="bg-zinc-900 text-white"
      />
      <Cell
        index={1}
        icon={CheckCircle2}
        label="Terhubung"
        value={formatNumber(stats.connected)}
        hint="Menerima pesan"
        accent="bg-emerald-500 text-white"
      />
      <Cell
        index={2}
        icon={Clock}
        label="Menunggu"
        value={formatNumber(stats.pending)}
        hint={stats.pending > 0 ? "Tunggu webhook pertama" : "Tidak ada"}
        accent={
          stats.pending > 0 ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-700"
        }
      />
      <Cell
        index={3}
        icon={AlertTriangle}
        label="Error"
        value={formatNumber(stats.error)}
        hint={stats.error > 0 ? "Perlu reconnect" : "Semua sehat"}
        accent={
          stats.error > 0 ? "bg-red-500 text-white" : "bg-zinc-100 text-zinc-700"
        }
      />
    </div>
  );
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
          <p className="mt-0.5 text-xl font-semibold tracking-tight">{value}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      </Card>
    </motion.div>
  );
}
