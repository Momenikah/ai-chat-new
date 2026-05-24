"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Activity,
  Check,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Webhook as WebhookIcon,
} from "lucide-react";
import {
  WEBHOOK_EVENTS,
  type WebhookDeliveryLog,
  type WebhookEndpoint,
} from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WebhooksStats } from "@/components/webhooks/webhooks-stats";
import { WebhookReference } from "@/components/webhooks/webhook-reference";
import {
  HeadersEditor,
  headersToRows,
  rowsToHeaders,
  type HeaderRow,
} from "@/components/webhooks/headers-editor";

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const can = useWorkspaceStore((s) => s.can);
  const canManage = can("ADMIN");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">(
    "all",
  );
  const [eventFilter, setEventFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["webhooks", workspaceId],
    queryFn: () => api.webhooks.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["webhooks", workspaceId] });

  const endpoints = useMemo(() => data?.endpoints ?? [], [data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return endpoints.filter((ep) => {
      if (statusFilter === "enabled" && !ep.enabled) return false;
      if (statusFilter === "disabled" && ep.enabled) return false;
      if (eventFilter !== "all" && !ep.events.includes(eventFilter)) return false;
      if (q && !ep.name.toLowerCase().includes(q) && !ep.url.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [endpoints, search, statusFilter, eventFilter]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-5"
    >
      <div className="flex items-end justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <WebhookIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Webhooks</h1>
            <p className="text-sm text-muted-foreground">
              Kirim event real-time ke URL Anda. Setiap payload ditandatangani
              HMAC-SHA256.
            </p>
          </div>
        </div>
        {canManage && workspaceId && (
          <WebhookDialog workspaceId={workspaceId} onSaved={invalidate} />
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-[88px] rounded-xl" />
      ) : (
        <WebhooksStats endpoints={endpoints} />
      )}

      <WebhookReference />

      {endpoints.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau URL…"
              className="h-9 w-full rounded-lg border border-input bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:bg-white"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "enabled" | "disabled")
            }
            className="h-9 w-32 text-sm"
          >
            <option value="all">Semua status</option>
            <option value="enabled">Aktif</option>
            <option value="disabled">Nonaktif</option>
          </Select>
          <Select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="h-9 w-44 text-sm"
          >
            <option value="all">Semua event</option>
            {WEBHOOK_EVENTS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : endpoints.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <WebhookIcon className="h-6 w-6 text-zinc-500" />
          </div>
          <p className="font-medium">Belum ada webhook</p>
          <p className="text-sm text-muted-foreground">
            Tambahkan endpoint untuk menerima notifikasi event.
          </p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          Tidak ada webhook yang cocok dengan filter.
        </Card>
      ) : (
        <ul className="space-y-3">
          {visible.map((ep) => (
            <EndpointRow
              key={ep.id}
              endpoint={ep}
              canManage={canManage}
              onChanged={invalidate}
            />
          ))}
        </ul>
      )}
    </motion.div>
  );
}

function EndpointRow({
  endpoint,
  canManage,
  onChanged,
}: {
  endpoint: WebhookEndpoint;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const test = useMutation({ mutationFn: () => api.webhooks.test(endpoint.id) });
  const rotate = useMutation({
    mutationFn: () => api.webhooks.rotateSecret(endpoint.id),
    onSuccess: onChanged,
  });
  const remove = useMutation({
    mutationFn: () => api.webhooks.remove(endpoint.id),
    onSuccess: onChanged,
  });

  const copySecret = async () => {
    await navigator.clipboard.writeText(endpoint.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <li>
      <Card className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium">{endpoint.name}</p>
              {endpoint.enabled ? (
                <Badge variant="success">enabled</Badge>
              ) : (
                <Badge variant="secondary">disabled</Badge>
              )}
              {endpoint.failure_count > 0 && (
                <Badge variant="warning">{endpoint.failure_count} gagal</Badge>
              )}
            </div>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {endpoint.url}
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              {endpoint.last_delivery_at ? (
                <>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded px-1.5 py-px font-mono",
                      endpoint.last_status && endpoint.last_status < 400
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700",
                    )}
                  >
                    {endpoint.last_status ?? "ERR"}
                  </span>
                  <span className="text-muted-foreground">
                    delivery terakhir {formatRelativeTime(endpoint.last_delivery_at)}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  Belum ada delivery
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {endpoint.events.map((e) => (
                <Badge key={e} variant="outline" className="font-mono text-[10px]">
                  {e}
                </Badge>
              ))}
            </div>
          </div>
          {canManage && (
            <div className="flex shrink-0 gap-1">
              <WebhookDialog
                workspaceId={endpoint.workspace_id}
                onSaved={onChanged}
                initial={endpoint}
                trigger={
                  <Button size="sm" variant="ghost">
                    Edit
                  </Button>
                }
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-red-600 hover:bg-red-50"
                disabled={remove.isPending}
                onClick={() => {
                  if (confirm(`Hapus webhook "${endpoint.name}"?`)) remove.mutate();
                }}
              >
                {remove.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Secret</span>
          <code className="flex-1 overflow-x-auto font-mono text-xs">
            {showSecret ? endpoint.secret : "whsec_••••••••••••••••"}
          </code>
          <Button size="sm" variant="ghost" onClick={() => setShowSecret((v) => !v)}>
            {showSecret ? "Sembunyikan" : "Lihat"}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copySecret}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => test.mutate()}
              disabled={test.isPending}
            >
              {test.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {test.isSuccess ? "Terkirim ke antrean" : "Test"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm("Rotasi secret? Integrasi lama harus diperbarui."))
                  rotate.mutate();
              }}
              disabled={rotate.isPending}
            >
              {rotate.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Rotasi secret
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowLogs((v) => !v)}>
              <Activity className="h-3.5 w-3.5" />
              {showLogs ? "Sembunyikan log" : "Lihat log pengiriman"}
            </Button>
          </div>
        )}

        {showLogs && <DeliveryLogs endpointId={endpoint.id} />}
      </Card>
    </li>
  );
}

function DeliveryLogs({ endpointId }: { endpointId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["webhook-deliveries", endpointId],
    queryFn: () => api.webhooks.deliveries(endpointId, 30),
  });
  const logs = data?.deliveries ?? [];

  if (isLoading) return <Skeleton className="h-20 rounded-lg" />;
  if (logs.length === 0)
    return (
      <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-muted-foreground">
        Belum ada pengiriman.
      </p>
    );

  return (
    <ul className="space-y-1.5">
      {logs.map((l: WebhookDeliveryLog) => (
        <li
          key={l.id}
          className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-1.5 text-xs"
        >
          <div className="flex items-center gap-2">
            <Badge variant={l.succeeded ? "success" : "destructive"}>
              {l.status_code ?? "ERR"}
            </Badge>
            <span className="font-mono">{l.event}</span>
            {l.attempt > 1 && (
              <span className="text-muted-foreground">retry #{l.attempt}</span>
            )}
          </div>
          <span className="text-muted-foreground">
            {l.duration_ms}ms • {new Date(l.created_at).toLocaleTimeString("id-ID")}
          </span>
        </li>
      ))}
    </ul>
  );
}

function WebhookDialog({
  workspaceId,
  onSaved,
  initial,
  trigger,
}: {
  workspaceId: string;
  onSaved: () => void;
  initial?: WebhookEndpoint;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [events, setEvents] = useState<string[]>(initial?.events ?? []);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>(
    headersToRows(initial?.headers),
  );

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        url,
        events,
        enabled,
        headers: rowsToHeaders(headerRows),
      };
      return initial
        ? api.webhooks.update(initial.id, payload)
        : api.webhooks.create(workspaceId, payload);
    },
    onSuccess: () => {
      onSaved();
      setOpen(false);
      if (!initial) {
        setName("");
        setUrl("");
        setEvents([]);
        setEnabled(true);
        setHeaderRows([]);
      }
    },
  });

  const err = mutation.error instanceof ApiException ? mutation.error.message : null;
  const toggleEvent = (e: string) =>
    setEvents((cur) => (cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" /> Webhook baru
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit webhook" : "Webhook baru"}</DialogTitle>
        </DialogHeader>
        <form
          id="webhook-form"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="wh-name">Nama</Label>
            <Input
              id="wh-name"
              required
              placeholder="n8n production"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wh-url">URL endpoint</Label>
            <Input
              id="wh-url"
              type="url"
              required
              placeholder="https://n8n.example.com/webhook/aichat"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Event</Label>
            <div className="grid grid-cols-1 gap-1.5">
              {WEBHOOK_EVENTS.map((e) => (
                <label
                  key={e}
                  className="flex items-center gap-2 rounded-lg border border-input p-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={events.includes(e)}
                    onChange={() => toggleEvent(e)}
                    className="h-4 w-4"
                  />
                  <span className="font-mono text-xs">{e}</span>
                </label>
              ))}
            </div>
          </div>
          <HeadersEditor rows={headerRows} onChange={setHeaderRows} />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            Aktif
          </label>
          {err && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>
          )}
        </form>
        <DialogFooter>
          <Button
            type="submit"
            form="webhook-form"
            disabled={mutation.isPending || events.length === 0}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
