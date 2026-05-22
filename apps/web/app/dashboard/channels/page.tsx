"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Check, Copy, Plug, Plus, Search, Webhook } from "lucide-react";
import type { ChannelStatus, ChannelType } from "@aichat/shared";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelCard } from "@/components/channels/channel-card";
import { ChannelsStats } from "@/components/channels/channels-stats";
import { ChannelSetupGuide } from "@/components/channels/setup-guide";

export default function ChannelsPage() {
  const queryClient = useQueryClient();
  const currentId = useWorkspaceStore((s) => s.currentId);
  const can = useWorkspaceStore((s) => s.can);
  const canManage = can("ADMIN");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ChannelType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ChannelStatus>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["channels", currentId],
    queryFn: () => api.channels.list(currentId as string),
    enabled: Boolean(currentId),
  });

  const channels = useMemo(() => data?.channels ?? [], [data]);
  const hasWhatsApp = channels.some((c) => c.type === "whatsapp");
  const hasInstagram = channels.some((c) => c.type === "instagram");
  const hasMessenger = channels.some((c) => c.type === "messenger");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return channels.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [channels, search, typeFilter, statusFilter]);

  const waInfo = useQuery({
    queryKey: ["whatsapp", "info", currentId],
    queryFn: () => api.whatsapp.info(currentId as string),
    enabled: Boolean(currentId) && hasWhatsApp,
  });
  const igInfo = useQuery({
    queryKey: ["instagram", "info", currentId],
    queryFn: () => api.instagram.info(currentId as string),
    enabled: Boolean(currentId) && hasInstagram,
  });
  const fbInfo = useQuery({
    queryKey: ["messenger", "info", currentId],
    queryFn: () => api.messenger.info(currentId as string),
    enabled: Boolean(currentId) && hasMessenger,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-4xl space-y-6"
    >
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Channel</h1>
          <p className="text-sm text-muted-foreground">
            Hubungkan WhatsApp, Instagram, dan Messenger ke workspace ini.
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/dashboard/channels/new">
              <Plus className="h-4 w-4" /> Tambah channel
            </Link>
          </Button>
        )}
      </div>

      {!isLoading && <ChannelsStats channels={channels} />}

      {waInfo.data && (
        <WebhookBanner
          label="WhatsApp Cloud API"
          path="Meta App Dashboard → WhatsApp → Configuration"
          url={waInfo.data.webhook_url}
        />
      )}
      {igInfo.data && (
        <WebhookBanner
          label="Instagram DM"
          path="Meta App Dashboard → Instagram → Webhooks → messages"
          url={igInfo.data.webhook_url}
        />
      )}
      {fbInfo.data && (
        <WebhookBanner
          label="Facebook Messenger"
          path="Meta App Dashboard → Messenger → Webhooks → subscribe page"
          url={fbInfo.data.webhook_url}
        />
      )}

      <ChannelSetupGuide />

      {channels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama channel…"
              className="h-9 w-full rounded-lg border border-input bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:bg-white"
            />
          </div>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "all" | ChannelType)}
            className="h-9 w-36 text-sm"
          >
            <option value="all">Semua tipe</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="messenger">Messenger</option>
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | ChannelStatus)
            }
            className="h-9 w-36 text-sm"
          >
            <option value="all">Semua status</option>
            <option value="connected">Terhubung</option>
            <option value="pending">Menunggu</option>
            <option value="disconnected">Terputus</option>
            <option value="error">Error</option>
          </Select>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <Plug className="h-6 w-6 text-zinc-500" />
          </div>
          <div>
            <p className="font-medium">Belum ada channel</p>
            <p className="text-sm text-muted-foreground">
              Tambahkan channel pertama untuk mulai menerima pesan.
            </p>
          </div>
          {canManage && (
            <Button asChild className="mt-1">
              <Link href="/dashboard/channels/new">
                <Plus className="h-4 w-4" /> Tambah channel
              </Link>
            </Button>
          )}
        </Card>
      ) : visible.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          Tidak ada channel yang cocok dengan filter.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((ch, i) => (
            <ChannelCard
              key={ch.id}
              channel={ch}
              index={i}
              canManage={canManage}
              onChanged={() =>
                queryClient.invalidateQueries({
                  queryKey: ["channels", currentId],
                })
              }
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function WebhookBanner({
  label,
  path,
  url,
}: {
  label: string;
  path: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <Card className="border-emerald-200 bg-emerald-50/40 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <Webhook className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Webhook {label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Salin URL ini ke {path}.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-white px-2 py-1.5 text-xs text-zinc-700 ring-1 ring-emerald-200">
              {url}
            </code>
            <button
              type="button"
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white px-2 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Tersalin
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Salin
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
