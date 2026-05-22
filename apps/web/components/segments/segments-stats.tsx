"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Crown, Layers, Sparkles, Users, type LucideIcon } from "lucide-react";
import type { SegmentWithRules } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export function SegmentsStats({
  segments,
}: {
  segments: SegmentWithRules[];
}) {
  const stats = useMemo(() => {
    const total = segments.length;
    let segmented = 0;
    let largest: SegmentWithRules | null = null;
    let empty = 0;
    for (const s of segments) {
      segmented += s.member_count;
      if (s.member_count === 0) empty++;
      if (!largest || s.member_count > largest.member_count) largest = s;
    }
    return { total, segmented, largest, empty };
  }, [segments]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCell
        index={0}
        icon={Layers}
        label="Total segment"
        value={formatNumber(stats.total)}
        hint={stats.empty > 0 ? `${stats.empty} kosong` : "Semua punya anggota"}
        accent="bg-zinc-900 text-white"
      />
      <StatCell
        index={1}
        icon={Users}
        label="Kontak ter-segmented"
        value={formatNumber(stats.segmented)}
        hint="Jumlah kursi lintas segment"
        accent="bg-emerald-500 text-white"
      />
      <StatCell
        index={2}
        icon={Crown}
        label={
          stats.largest ? `Terbesar · ${truncate(stats.largest.name, 12)}` : "Terbesar"
        }
        value={
          stats.largest ? formatNumber(stats.largest.member_count) : "—"
        }
        hint={stats.largest ? "anggota" : "Belum ada segment"}
        accent={
          stats.largest ? "bg-blue-500 text-white" : "bg-zinc-100 text-zinc-700"
        }
      />
      <StatCell
        index={3}
        icon={Sparkles}
        label="Aturan rata-rata"
        value={
          stats.total === 0
            ? "—"
            : (
                segments.reduce((sum, s) => sum + s.rules.length, 0) /
                stats.total
              ).toFixed(1)
        }
        hint="Aturan per segment"
        accent="bg-violet-500 text-white"
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

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
