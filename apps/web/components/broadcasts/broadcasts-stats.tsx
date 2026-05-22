"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  Activity,
  CheckCircle2,
  Send,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { BroadcastCampaign } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export function BroadcastsStats({
  campaigns,
}: {
  campaigns: BroadcastCampaign[];
}) {
  const stats = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let sent30 = 0;
    let sumDelivered = 0;
    let sumSent = 0;
    let sending = 0;
    for (const c of campaigns) {
      if (c.status === "sending") sending++;
      if (new Date(c.created_at).getTime() >= cutoff) {
        sent30 += c.sent_count;
      }
      sumSent += c.sent_count;
      sumDelivered += c.delivered_count;
    }
    const deliveryRate =
      sumSent > 0 ? (sumDelivered / sumSent) * 100 : null;
    return { total: campaigns.length, sent30, deliveryRate, sending };
  }, [campaigns]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCell
        index={0}
        icon={Send}
        label="Total campaign"
        value={formatNumber(stats.total)}
        hint={
          stats.sending > 0
            ? `${stats.sending} sedang berjalan`
            : "Tidak ada yang sedang sending"
        }
        accent="bg-zinc-900 text-white"
      />
      <StatCell
        index={1}
        icon={TrendingUp}
        label="Terkirim 30 hari"
        value={formatNumber(stats.sent30)}
        hint="Total pesan keluar campaign"
        accent="bg-emerald-500 text-white"
      />
      <StatCell
        index={2}
        icon={CheckCircle2}
        label="Delivery rate"
        value={
          stats.deliveryRate === null
            ? "—"
            : `${stats.deliveryRate.toFixed(1)}%`
        }
        hint="delivered / sent kumulatif"
        accent={
          stats.deliveryRate === null
            ? "bg-zinc-100 text-zinc-700"
            : stats.deliveryRate >= 95
              ? "bg-blue-500 text-white"
              : "bg-amber-500 text-white"
        }
      />
      <StatCell
        index={3}
        icon={Activity}
        label="Aktif sekarang"
        value={formatNumber(stats.sending)}
        hint={stats.sending > 0 ? "Pantau di detail" : "Antrian kosong"}
        accent={
          stats.sending > 0
            ? "bg-violet-500 text-white"
            : "bg-zinc-100 text-zinc-700"
        }
      />
    </div>
  );
}

function StatCell({
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
          <p className="mt-0.5 text-xl font-semibold tracking-tight">
            {value}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
      </Card>
    </motion.div>
  );
}
