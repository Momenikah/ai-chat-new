"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  Plug,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ChannelType, Contact } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { CHANNEL_META } from "@/components/channels/channel-meta";
import { formatNumber } from "@/lib/utils";

interface ContactsStatsProps {
  contacts: Contact[];
  duplicatesCount: number;
}

export function ContactsStats({ contacts, duplicatesCount }: ContactsStatsProps) {
  const stats = useMemo(() => {
    const total = contacts.length;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let newCount = 0;
    const byChannel: Record<ChannelType, number> = {
      whatsapp: 0,
      instagram: 0,
      messenger: 0,
      onesender: 0,
      starsender: 0,
    };
    let withoutChannel = 0;
    for (const c of contacts) {
      if (new Date(c.created_at).getTime() >= weekAgo) newCount++;
      if (c.external_source) byChannel[c.external_source]++;
      else withoutChannel++;
    }
    const topChannel = (
      Object.entries(byChannel) as [ChannelType, number][]
    )
      .sort((a, b) => b[1] - a[1])
      .find(([, n]) => n > 0);
    return { total, newCount, byChannel, withoutChannel, topChannel };
  }, [contacts]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCell
        label="Total kontak"
        value={formatNumber(stats.total)}
        hint="Di workspace ini"
        icon={Users}
        accent="bg-zinc-900 text-white"
        index={0}
      />
      <StatCell
        label="Baru 7 hari"
        value={formatNumber(stats.newCount)}
        hint={
          stats.total > 0
            ? `${((stats.newCount / stats.total) * 100).toFixed(0)}% dari total`
            : "Belum ada data"
        }
        icon={TrendingUp}
        accent="bg-emerald-500 text-white"
        index={1}
      />
      <StatCell
        label={
          stats.topChannel
            ? `Top channel · ${CHANNEL_META[stats.topChannel[0]].label.split(" ")[0]}`
            : "Distribusi channel"
        }
        value={
          stats.topChannel ? formatNumber(stats.topChannel[1]) : "—"
        }
        hint={
          stats.withoutChannel > 0
            ? `${formatNumber(stats.withoutChannel)} tanpa channel`
            : "Semua punya channel"
        }
        icon={Plug}
        accent={
          stats.topChannel
            ? "bg-blue-500 text-white"
            : "bg-zinc-100 text-zinc-700"
        }
        index={2}
      />
      <StatCell
        label="Duplikat terdeteksi"
        value={formatNumber(duplicatesCount)}
        hint={
          duplicatesCount > 0
            ? "Periksa & gabungkan"
            : "Database bersih"
        }
        icon={AlertTriangle}
        accent={
          duplicatesCount > 0
            ? "bg-amber-500 text-white"
            : "bg-zinc-100 text-zinc-700"
        }
        index={3}
      />
    </div>
  );
}

function StatCell({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  index,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
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
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
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
