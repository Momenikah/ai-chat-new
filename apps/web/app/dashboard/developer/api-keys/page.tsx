"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import type { APIKey, CreatedAPIKey } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { cn } from "@/lib/utils";
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
import { ApiKeysStats } from "@/components/api-keys/api-keys-stats";
import { UsageLogsPanel } from "@/components/api-keys/usage-logs-panel";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const SCOPE_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: "messages:send", label: "Kirim pesan", desc: "POST /public/messages/*" },
  { value: "contacts:read", label: "Baca kontak", desc: "GET /public/contacts" },
  { value: "contacts:write", label: "Tulis kontak", desc: "POST /public/contacts" },
  {
    value: "conversations:read",
    label: "Baca percakapan",
    desc: "GET /public/conversations",
  },
];

type StatusFilter = "all" | "active" | "revoked";

export default function APIKeysPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const can = useWorkspaceStore((s) => s.can);
  const canManage = can("ADMIN");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["api-keys", workspaceId],
    queryFn: () => api.apiKeys.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const usageQ = useQuery({
    queryKey: ["api-usage", workspaceId],
    queryFn: () => api.apiKeys.usage(workspaceId as string, 100),
    enabled: Boolean(workspaceId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["api-keys", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["api-usage", workspaceId] });
  };

  const keys = useMemo(() => data?.api_keys ?? [], [data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return keys.filter((k) => {
      const revoked = Boolean(k.revoked_at);
      if (statusFilter === "active" && revoked) return false;
      if (statusFilter === "revoked" && !revoked) return false;
      if (q && !k.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [keys, search, statusFilter]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-4xl space-y-5"
    >
      <div className="flex items-end justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">API Keys</h1>
            <p className="text-sm text-muted-foreground">
              Kunci untuk mengakses Public API. Kunci hanya ditampilkan sekali
              saat dibuat — simpan baik-baik.
            </p>
          </div>
        </div>
        {canManage && workspaceId && (
          <CreateKeyDialog workspaceId={workspaceId} onSaved={invalidate} />
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-[88px] rounded-xl" />
      ) : (
        <ApiKeysStats
          keys={keys}
          totalCalls={usageQ.data ? usageQ.data.logs.length : null}
        />
      )}

      {keys.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama key…"
              className="h-9 w-full rounded-lg border border-input bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:bg-white"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-9 w-36 text-sm"
          >
            <option value="all">Semua status</option>
            <option value="active">Aktif</option>
            <option value="revoked">Dicabut</option>
          </Select>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : keys.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <KeyRound className="h-6 w-6 text-zinc-500" />
          </div>
          <p className="font-medium">Belum ada API key</p>
          <p className="text-sm text-muted-foreground">
            Buat kunci pertama untuk mulai memakai Public API.
          </p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          Tidak ada key yang cocok dengan filter.
        </Card>
      ) : (
        <ul className="space-y-2">
          {visible.map((k) => (
            <KeyRow
              key={k.id}
              apiKey={k}
              canManage={canManage}
              onChanged={invalidate}
            />
          ))}
        </ul>
      )}

      {workspaceId && keys.length > 0 && (
        <UsageLogsPanel workspaceId={workspaceId} />
      )}
    </motion.div>
  );
}

function KeyRow({
  apiKey,
  canManage,
  onChanged,
}: {
  apiKey: APIKey;
  canManage: boolean;
  onChanged: () => void;
}) {
  const revoke = useMutation({
    mutationFn: () => api.apiKeys.revoke(apiKey.id),
    onSuccess: onChanged,
  });
  const revoked = Boolean(apiKey.revoked_at);
  const stale = !revoked && !apiKey.last_used_at;
  return (
    <li>
      <Card className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{apiKey.name}</p>
            {revoked ? (
              <Badge variant="destructive">revoked</Badge>
            ) : stale ? (
              <Badge variant="warning">belum dipakai</Badge>
            ) : (
              <Badge variant="success">active</Badge>
            )}
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {apiKey.prefix}••••••••
          </p>
          {apiKey.scopes.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {apiKey.scopes.map((s) => (
                <span
                  key={s}
                  className="rounded bg-zinc-100 px-1.5 py-px font-mono text-[10px] text-zinc-600"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            Dibuat {new Date(apiKey.created_at).toLocaleDateString("id-ID")}
            {apiKey.last_used_at
              ? ` • Terakhir dipakai ${new Date(apiKey.last_used_at).toLocaleString("id-ID")}`
              : " • Belum pernah dipakai"}
          </p>
        </div>
        {canManage && !revoked && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-red-600 hover:bg-red-50"
            disabled={revoke.isPending}
            onClick={() => {
              if (confirm(`Cabut API key "${apiKey.name}"? Aksi ini permanen.`))
                revoke.mutate();
            }}
          >
            {revoke.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </Card>
    </li>
  );
}

function CreateKeyDialog({
  workspaceId,
  onSaved,
}: {
  workspaceId: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [created, setCreated] = useState<CreatedAPIKey | null>(null);
  const [copied, setCopied] = useState<"key" | "curl" | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.apiKeys.create(workspaceId, {
        name,
        scopes: scopes.length > 0 ? scopes : undefined,
      }),
    onSuccess: (res) => {
      setCreated(res);
      onSaved();
    },
  });

  const err = mutation.error instanceof ApiException ? mutation.error.message : null;

  const close = () => {
    setOpen(false);
    setName("");
    setScopes([]);
    setCreated(null);
    setCopied(null);
  };

  const toggleScope = (s: string) =>
    setScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const curl = created
    ? `curl -X POST ${API_URL}/public/messages/send \\
  -H "Authorization: Bearer ${created.plaintext}" \\
  -H "Content-Type: application/json" \\
  -d '{ "channel_id": "<uuid>", "to": "6281234567890", "body": "Halo!" }'`
    : "";

  const copy = async (text: string, which: "key" | "curl") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> API key baru
        </Button>
      </DialogTrigger>
      <DialogContent className={created ? "max-w-lg" : undefined}>
        <DialogHeader>
          <DialogTitle>
            {created ? "API key dibuat" : "Buat API key"}
          </DialogTitle>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Salin kunci ini sekarang. Demi keamanan, kunci tidak akan
                ditampilkan lagi.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Kunci</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-lg border border-input bg-zinc-50 px-3 py-2 font-mono text-xs">
                  {created.plaintext}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copy(created.plaintext, "key")}
                >
                  {copied === "key" ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Quick-start (cURL)</Label>
                <button
                  type="button"
                  onClick={() => copy(curl, "curl")}
                  className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900"
                >
                  {copied === "curl" ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" /> tersalin
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> salin
                    </>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto rounded-lg border border-input bg-zinc-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-100">
                {curl}
              </pre>
            </div>

            <DialogFooter>
              <Button onClick={close}>Selesai</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <form
              id="create-key"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="key-name">Nama</Label>
                <Input
                  id="key-name"
                  required
                  placeholder="Production server"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Beri nama yang menjelaskan di mana kunci ini dipakai.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Scopes (opsional)</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SCOPE_OPTIONS.map((s) => {
                    const checked = scopes.includes(s.value);
                    return (
                      <label
                        key={s.value}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-lg border p-2 transition-colors",
                          checked
                            ? "border-zinc-900 bg-zinc-50"
                            : "border-input hover:bg-zinc-50",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleScope(s.value)}
                          className="mt-0.5 h-3.5 w-3.5"
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium">
                            {s.label}
                          </span>
                          <span className="block font-mono text-[10px] text-muted-foreground">
                            {s.value}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Kosongkan untuk akses penuh ke seluruh Public API.
                </p>
              </div>

              {err && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {err}
                </p>
              )}
            </form>
            <DialogFooter>
              <Button type="submit" form="create-key" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Buat kunci
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
