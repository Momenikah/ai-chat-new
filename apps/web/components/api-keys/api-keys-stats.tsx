"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  Activity,
  CheckCircle2,
  KeyRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { APIKey } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export function ApiKeysStats({
  keys,
  totalCalls,
}: {
  keys: APIKey[];
  totalCalls: number | null;
}) {
  const stats = useMemo(() => {
    let active = 0;
    let revoked = 0;
    for (const k of keys) {
      if (k.revoked_at) revoked++;
      else active++;
    }
    return { total: keys.length, active, revoked };
  }, [keys]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Cell
        index={0}
        icon={KeyRound}
        label="Total key"
        value={formatNumber(stats.total)}
        hint="Termasuk yang dicabut"
        accent="bg-zinc-900 text-white"
      />
      <Cell
        index={1}
        icon={CheckCircle2}
        label="Aktif"
        value={formatNumber(stats.active)}
        hint="Bisa mengakses Public API"
        accent="bg-emerald-500 text-white"
      />
      <Cell
        index={2}
        icon={XCircle}
        label="Dicabut"
        value={formatNumber(stats.revoked)}
        hint={stats.revoked > 0 ? "Tidak bisa dipakai" : "Tidak ada"}
        accent={
          stats.revoked > 0 ? "bg-red-500 text-white" : "bg-zinc-100 text-zinc-700"
        }
      />
      <Cell
        index={3}
        icon={Activity}
        label="API call (log)"
        value={totalCalls === null ? "—" : formatNumber(totalCalls)}
        hint="Request tercatat terakhir"
        accent="bg-blue-500 text-white"
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
