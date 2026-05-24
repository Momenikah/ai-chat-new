"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  CheckCircle2,
  Clock,
  Copy,
  FileX,
  Loader2,
  Plus,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import type { BroadcastCampaign, BroadcastStatus } from "@aichat/shared";
import { api } from "@/lib/api";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BroadcastsStats } from "@/components/broadcasts/broadcasts-stats";

const STATUS_META: Record<
  BroadcastStatus,
  {
    variant: "success" | "warning" | "secondary" | "destructive";
    icon: typeof CheckCircle2;
    label: string;
  }
> = {
  draft: { variant: "secondary", icon: FileX, label: "draft" },
  scheduled: { variant: "warning", icon: Clock, label: "scheduled" },
  sending: { variant: "warning", icon: Loader2, label: "sending" },
  completed: { variant: "success", icon: CheckCircle2, label: "completed" },
  failed: { variant: "destructive", icon: XCircle, label: "failed" },
  cancelled: { variant: "secondary", icon: XCircle, label: "cancelled" },
};

const STATUS_KEYS: BroadcastStatus[] = [
  "draft",
  "scheduled",
  "sending",
  "completed",
  "failed",
  "cancelled",
];

type StatusFilter = "all" | BroadcastStatus;

export default function BroadcastsPage() {
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const can = useWorkspaceStore((s) => s.can);
  const canManage = can("ADMIN");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["broadcasts", workspaceId],
    queryFn: () => api.broadcasts.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const items = data?.broadcasts ?? [];

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: items.length,
      draft: 0,
      scheduled: 0,
      sending: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const c of items) counts[c.status]++;
    return counts;
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, statusFilter]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-5xl space-y-5"
    >
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Broadcast</h1>
          <p className="text-sm text-muted-foreground">
            Campaign massal — antrian dikirim worker dengan rate limit per
            channel.
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/dashboard/broadcasts/new">
              <Plus className="h-4 w-4" /> Campaign baru
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-[88px] rounded-xl" />
      ) : (
        <BroadcastsStats campaigns={items} />
      )}

      {items.length > 0 && (
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama campaign…"
              className="h-9 w-full rounded-lg border border-input bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:bg-white"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusChip
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
              count={statusCounts.all}
            >
              Semua
            </StatusChip>
            {STATUS_KEYS.map((s) => (
              <StatusChip
                key={s}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
                count={statusCounts[s]}
                statusVariant={STATUS_META[s].variant}
              >
                {STATUS_META[s].label}
              </StatusChip>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <Send className="h-6 w-6 text-zinc-500" />
          </div>
          <p className="font-medium">Belum ada campaign</p>
          <p className="text-sm text-muted-foreground">
            Buat campaign untuk mengirim ke audience tertentu.
          </p>
          {canManage && (
            <Button asChild className="mt-2">
              <Link href="/dashboard/broadcasts/new">
                <Plus className="h-4 w-4" /> Campaign baru
              </Link>
            </Button>
          )}
        </Card>
      ) : visible.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          Tidak ada campaign dengan filter ini.
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((c, i) => (
            <CampaignRow key={c.id} campaign={c} index={i} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function StatusChip({
  active,
  onClick,
  count,
  children,
  statusVariant,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
  statusVariant?: "success" | "warning" | "secondary" | "destructive";
}) {
  const variantHint = statusVariant
    ? {
        success: "before:bg-emerald-500",
        warning: "before:bg-amber-500",
        secondary: "before:bg-zinc-400",
        destructive: "before:bg-red-500",
      }[statusVariant]
    : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition-colors",
        statusVariant &&
          `before:mr-0.5 before:h-1.5 before:w-1.5 before:rounded-full ${variantHint}`,
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
      )}
    >
      <span>{children}</span>
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px]",
          active ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-500",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function CampaignRow({
  campaign,
  index,
}: {
  campaign: BroadcastCampaign;
  index: number;
}) {
  const meta = STATUS_META[campaign.status];
  const Icon = meta.icon;
  const spinning = campaign.status === "sending";
  const total = campaign.total_recipients || 0;
  const finished = campaign.sent_count + campaign.failed_count;
  const progress = total > 0 ? Math.round((finished / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
      whileHover={{ y: -2 }}
    >
      <Card className="overflow-hidden p-5 transition-shadow hover:shadow-md">
        <Link
          href={`/dashboard/broadcasts/${campaign.id}`}
          className="flex items-start gap-3"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
            <Send className="h-4 w-4 text-zinc-700" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{campaign.name}</p>
            <p className="text-xs text-muted-foreground">
              {campaign.audience_kind} · {campaign.total_recipients}{" "}
              recipient · {campaign.rate_per_minute}/min
            </p>
          </div>
          <Badge variant={meta.variant} className="gap-1">
            <Icon className={`h-3 w-3 ${spinning ? "animate-spin" : ""}`} />
            {meta.label}
          </Badge>
        </Link>

        {total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
                className="h-full rounded-full bg-zinc-900"
              />
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 text-center text-xs">
          <Counter label="sent" value={campaign.sent_count} />
          <Counter label="delivered" value={campaign.delivered_count} />
          <Counter label="read" value={campaign.read_count} />
          <Counter label="failed" value={campaign.failed_count} />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {formatRelativeTime(campaign.created_at)}
          </span>
          <Link
            href={`/dashboard/broadcasts/new?from=${campaign.id}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            title="Duplicate campaign"
          >
            <Copy className="h-3 w-3" /> Duplicate
          </Link>
        </div>
      </Card>
    </motion.div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-base font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
