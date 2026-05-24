"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  CheckCircle2,
  Clock,
  FileText,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { MessageTemplate } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export function TemplatesStats({
  templates,
}: {
  templates: MessageTemplate[];
}) {
  const stats = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    for (const t of templates) {
      if (t.status === "approved") approved++;
      else if (t.status === "pending") pending++;
      else if (t.status === "rejected") rejected++;
    }
    const reviewed = approved + rejected;
    const rate = reviewed > 0 ? (approved / reviewed) * 100 : null;
    return { total: templates.length, approved, pending, rejected, rate };
  }, [templates]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCell
        index={0}
        icon={FileText}
        label="Total template"
        value={formatNumber(stats.total)}
        hint={
          stats.total - stats.approved - stats.pending - stats.rejected > 0
            ? `${
                stats.total - stats.approved - stats.pending - stats.rejected
              } draft`
            : "Semua sudah disubmit"
        }
        accent="bg-zinc-900 text-white"
      />
      <StatCell
        index={1}
        icon={CheckCircle2}
        label="Disetujui Meta"
        value={formatNumber(stats.approved)}
        hint="Siap dipakai broadcast"
        accent="bg-emerald-500 text-white"
      />
      <StatCell
        index={2}
        icon={Clock}
        label="Menunggu review"
        value={formatNumber(stats.pending)}
        hint={
          stats.rejected > 0 ? `${stats.rejected} ditolak` : "Tidak ada penolakan"
        }
        accent={
          stats.pending > 0
            ? "bg-amber-500 text-white"
            : "bg-zinc-100 text-zinc-700"
        }
      />
      <StatCell
        index={3}
        icon={TrendingUp}
        label="Approval rate"
        value={stats.rate === null ? "—" : `${stats.rate.toFixed(0)}%`}
        hint={
          stats.rate === null
            ? "Belum ada review"
            : stats.rate >= 80
              ? "Kualitas baik"
              : "Periksa template yang ditolak"
        }
        accent={
          stats.rate === null
            ? "bg-zinc-100 text-zinc-700"
            : stats.rate >= 80
              ? "bg-blue-500 text-white"
              : "bg-amber-500 text-white"
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
          <p className="mt-0.5 text-xl font-semibold tracking-tight">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
      </Card>
    </motion.div>
  );
}
