"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  CheckCircle2,
  Radio,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import type { WebhookEndpoint } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export function WebhooksStats({
  endpoints,
}: {
  endpoints: WebhookEndpoint[];
}) {
  const stats = useMemo(() => {
    let enabled = 0;
    let failing = 0;
    const events = new Set<string>();
    for (const e of endpoints) {
      if (e.enabled) enabled++;
      if (e.failure_count > 0) failing++;
      e.events.forEach((ev) => events.add(ev));
    }
    return {
      total: endpoints.length,
      enabled,
      failing,
      events: events.size,
    };
  }, [endpoints]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Cell
        index={0}
        icon={Webhook}
        label="Total endpoint"
        value={formatNumber(stats.total)}
        hint={`${stats.enabled} aktif`}
        accent="bg-zinc-900 text-white"
      />
      <Cell
        index={1}
        icon={CheckCircle2}
        label="Aktif"
        value={formatNumber(stats.enabled)}
        hint="Menerima event"
        accent="bg-emerald-500 text-white"
      />
      <Cell
        index={2}
        icon={AlertTriangle}
        label="Bermasalah"
        value={formatNumber(stats.failing)}
        hint={stats.failing > 0 ? "Ada kegagalan kirim" : "Semua sehat"}
        accent={
          stats.failing > 0 ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-700"
        }
      />
      <Cell
        index={3}
        icon={Radio}
        label="Event di-subscribe"
        value={formatNumber(stats.events)}
        hint="Jenis event unik"
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
