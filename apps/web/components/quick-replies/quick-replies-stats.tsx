"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  AlignLeft,
  Braces,
  Hash,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { QuickReply } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export function QuickRepliesStats({
  replies,
}: {
  replies: QuickReply[];
}) {
  const stats = useMemo(() => {
    const total = replies.length;
    if (total === 0) {
      return {
        total: 0,
        avgLength: 0,
        shortestShortcut: null as string | null,
        withVariables: 0,
      };
    }
    let totalLen = 0;
    let withVariables = 0;
    let shortestShortcut = replies[0].shortcut;
    for (const r of replies) {
      totalLen += r.body.length;
      if (/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(r.body)) withVariables++;
      if (r.shortcut.length < shortestShortcut.length) {
        shortestShortcut = r.shortcut;
      }
    }
    return {
      total,
      avgLength: Math.round(totalLen / total),
      shortestShortcut,
      withVariables,
    };
  }, [replies]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCell
        index={0}
        icon={Zap}
        label="Total quick reply"
        value={formatNumber(stats.total)}
        hint="Siap dipakai di composer"
        accent="bg-zinc-900 text-white"
      />
      <StatCell
        index={1}
        icon={AlignLeft}
        label="Rata-rata panjang"
        value={`${stats.avgLength}`}
        hint="karakter per balasan"
        accent="bg-emerald-500 text-white"
      />
      <StatCell
        index={2}
        icon={Hash}
        label="Shortcut tercepat"
        value={stats.shortestShortcut ? `/${stats.shortestShortcut}` : "—"}
        hint="Ketik di composer untuk auto-expand"
        accent="bg-blue-500 text-white"
      />
      <StatCell
        index={3}
        icon={Braces}
        label="Dengan variabel"
        value={formatNumber(stats.withVariables)}
        hint={
          stats.withVariables > 0
            ? "Balasan dinamis dari kontak"
            : "Belum pakai placeholder"
        }
        accent={
          stats.withVariables > 0
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
          <p className="mt-0.5 truncate text-xl font-semibold tracking-tight">
            {value}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
      </Card>
    </motion.div>
  );
}
