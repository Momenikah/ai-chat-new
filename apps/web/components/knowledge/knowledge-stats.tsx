"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  Layers,
  type LucideIcon,
} from "lucide-react";
import type { KnowledgeDocument } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export function KnowledgeStats({
  docs,
}: {
  docs: KnowledgeDocument[];
}) {
  const stats = useMemo(() => {
    let ready = 0;
    let processing = 0;
    let failed = 0;
    let chunks = 0;
    for (const d of docs) {
      if (d.status === "ready") ready++;
      else if (d.status === "processing") processing++;
      else if (d.status === "failed") failed++;
      chunks += d.chunk_count;
    }
    return { total: docs.length, ready, processing, failed, chunks };
  }, [docs]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Cell
        index={0}
        icon={BookOpen}
        label="Total dokumen"
        value={formatNumber(stats.total)}
        hint={stats.failed > 0 ? `${stats.failed} gagal` : "Semua terindeks"}
        accent="bg-zinc-900 text-white"
      />
      <Cell
        index={1}
        icon={CheckCircle2}
        label="Siap dipakai"
        value={formatNumber(stats.ready)}
        hint="Aktif sebagai rujukan RAG"
        accent="bg-emerald-500 text-white"
      />
      <Cell
        index={2}
        icon={Clock3}
        label="Sedang diproses"
        value={formatNumber(stats.processing)}
        hint={stats.processing > 0 ? "Embedding berjalan" : "Antrian kosong"}
        accent={
          stats.processing > 0
            ? "bg-amber-500 text-white"
            : "bg-zinc-100 text-zinc-700"
        }
      />
      <Cell
        index={3}
        icon={Layers}
        label="Total chunk"
        value={formatNumber(stats.chunks)}
        hint="Potongan teks ter-embed"
        accent="bg-violet-500 text-white"
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
