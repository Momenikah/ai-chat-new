"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import {
  GATEWAY_PROVIDERS,
  isGatewayChannel,
  type Channel,
  type GatewayInfo,
  type GatewayProvider,
} from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CHANNEL_META, STATUS_META } from "@/components/channels/channel-meta";
import { CopyRow } from "@/components/channels/meta-channel-card";

const PROVIDER_COPY: Record<
  GatewayProvider,
  { title: string; blurb: string; keyLabel: string; webhookWhere: string }
> = {
  onesender: {
    title: "OneSender",
    blurb: "Instance OneSender self-hosted Anda (onesender.net).",
    keyLabel: "API Key",
    webhookWhere: "dashboard OneSender → Pengaturan → Webhook",
  },
  starsender: {
    title: "StarSender",
    blurb: "Layanan StarSender V3 (starsender.online).",
    keyLabel: "Device API Key",
    webhookWhere: "app.starsender.online → Device → Webhook",
  },
};

export default function WaGatewayPage() {
  // useSearchParams needs a Suspense boundary for static rendering.
  return (
    <Suspense fallback={null}>
      <WaGatewayContent />
    </Suspense>
  );
}

function WaGatewayContent() {
  const params = useSearchParams();
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const queryClient = useQueryClient();

  const initial = params.get("provider");
  const [provider, setProvider] = useState<GatewayProvider>(
    initial === "starsender" ? "starsender" : "onesender",
  );
  const [form, setForm] = useState({
    name: "",
    base_url: "",
    api_key: "",
    phone_number: "",
  });
  const [result, setResult] = useState<GatewayInfo | null>(null);

  const channelsQuery = useQuery({
    queryKey: ["channels", workspaceId],
    queryFn: () => api.channels.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const gateways = (channelsQuery.data?.channels ?? []).filter((c) =>
    isGatewayChannel(c.type),
  );

  const mutation = useMutation({
    mutationFn: () =>
      api.gateway.connect(workspaceId as string, {
        provider,
        name: form.name.trim() || `WhatsApp ${PROVIDER_COPY[provider].title}`,
        api_key: form.api_key.trim(),
        base_url:
          provider === "onesender" ? form.base_url.trim() || undefined : undefined,
        phone_number: form.phone_number.trim() || undefined,
      }),
    onSuccess: (info) => {
      setResult(info);
      setForm((f) => ({ ...f, api_key: "" }));
      queryClient.invalidateQueries({ queryKey: ["channels", workspaceId] });
    },
  });

  const error =
    mutation.error instanceof ApiException ? mutation.error.message : null;
  const copy = PROVIDER_COPY[provider];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-2xl space-y-6"
    >
      <div>
        <Link
          href="/dashboard/channels"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke channel
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          WhatsApp via Gateway (Unofficial)
        </h1>
        <p className="text-sm text-muted-foreground">
          Hubungkan nomor WhatsApp biasa lewat OneSender atau StarSender —
          tanpa verifikasi Meta Business.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Gateway unofficial bekerja lewat WhatsApp Web, bukan API resmi Meta.
          Nomor bisa diblokir WhatsApp bila mengirim spam atau broadcast
          berlebihan — gunakan rate limit rendah dan kirim hanya ke kontak
          yang sudah memberi izin.
        </p>
      </div>

      {gateways.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Gateway terhubung
          </p>
          {gateways.map((c) => (
            <GatewayChannelRow
              key={c.id}
              channel={c}
              defaultOpen={params.get("channel") === c.id}
            />
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {GATEWAY_PROVIDERS.map((p) => {
          const meta = CHANNEL_META[p];
          const Icon = meta.icon;
          const active = p === provider;
          return (
            <button
              key={p}
              type="button"
              onClick={() => {
                setProvider(p);
                mutation.reset();
                setResult(null);
              }}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-white p-4 text-left transition-all",
                active
                  ? "border-zinc-900 ring-1 ring-zinc-900"
                  : "border-border hover:border-zinc-300",
              )}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ background: meta.color }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-medium">
                  {PROVIDER_COPY[p].title}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {PROVIDER_COPY[p].blurb}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hubungkan {copy.title}</CardTitle>
          <CardDescription>
            Pastikan perangkat WhatsApp sudah di-scan QR dan online di{" "}
            {copy.title}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="space-y-4"
          >
            <Field
              id="gw-name"
              label="Nama channel"
              placeholder={`WhatsApp ${copy.title}`}
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
            />
            {provider === "onesender" && (
              <Field
                id="gw-url"
                label="URL instance OneSender"
                placeholder="https://wa.domainanda.com"
                type="url"
                value={form.base_url}
                onChange={(v) => setForm({ ...form, base_url: v })}
                required
              />
            )}
            <Field
              id="gw-key"
              label={copy.keyLabel}
              placeholder="••••••••"
              type="password"
              value={form.api_key}
              onChange={(v) => setForm({ ...form, api_key: v })}
              required
            />
            <Field
              id="gw-phone"
              label="Nomor WhatsApp perangkat (opsional)"
              placeholder="0812xxxxxxx"
              value={form.phone_number}
              onChange={(v) => setForm({ ...form, phone_number: v })}
              hint="Dipakai sebagai label dan untuk memperbarui channel yang sama saat menghubungkan ulang."
            />

            <p className="flex items-start gap-1.5 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              API key dienkripsi AES-256-GCM dan tidak pernah ditampilkan
              kembali.
            </p>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/channels">Batal</Link>
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Hubungkan {copy.title}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" /> {result.channel.name}{" "}
              tersimpan
            </CardTitle>
            <CardDescription>
              Langkah terakhir: salin Webhook URL ke {copy.webhookWhere} agar
              pesan masuk tampil di Inbox, lalu kirim pesan tes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GatewayDetails info={result} />
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

/** Collapsible row for an existing gateway channel. */
function GatewayChannelRow({
  channel,
  defaultOpen,
}: {
  channel: Channel;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = CHANNEL_META[channel.type];
  const status = STATUS_META[channel.status];
  const Icon = meta.icon;

  const infoQuery = useQuery({
    queryKey: ["gateway", channel.id],
    queryFn: () => api.gateway.info(channel.id),
    enabled: open,
  });

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ background: meta.color }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{channel.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {meta.label}
            {channel.external_id ? ` · +${channel.external_id}` : ""}
          </span>
        </span>
        <Badge variant={status.variant}>{status.label}</Badge>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-border p-4">
          {channel.error_message && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {channel.error_message}
            </p>
          )}
          {infoQuery.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : infoQuery.data ? (
            <GatewayDetails info={infoQuery.data} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Gagal memuat detail gateway.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

/** Webhook URL, rotate-token and test-send controls for one gateway. */
function GatewayDetails({ info }: { info: GatewayInfo }) {
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState(info);
  const [test, setTest] = useState({ to: "", body: "Tes koneksi dari AI Chat ✅" });

  const rotate = useMutation({
    mutationFn: () => api.gateway.rotateToken(current.channel.id),
    onSuccess: (next) => {
      setCurrent(next);
      queryClient.setQueryData(["gateway", next.channel.id], next);
    },
  });

  const send = useMutation({
    mutationFn: () => api.gateway.test(current.channel.id, test),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["channels", current.channel.workspace_id],
      }),
  });

  const sendError = send.error instanceof ApiException ? send.error.message : null;

  return (
    <div className="space-y-4">
      <CopyRow label="Webhook URL (pesan masuk)" value={current.webhook_url} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          API key: <code>{current.api_key_hint || "tersimpan"}</code>
        </span>
        {current.base_url && (
          <span>
            Instance: <code>{current.base_url}</code>
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                "Buat Webhook URL baru? URL lama langsung berhenti bekerja dan harus diganti di dashboard gateway.",
              )
            ) {
              rotate.mutate();
            }
          }}
          disabled={rotate.isPending}
          className="inline-flex items-center gap-1 font-medium text-zinc-700 hover:text-zinc-900"
        >
          <RefreshCw className={cn("h-3 w-3", rotate.isPending && "animate-spin")} />
          Ganti Webhook URL
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
        className="space-y-2 rounded-lg border border-border p-3"
      >
        <p className="text-xs font-medium">Kirim pesan tes</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            required
            placeholder="Nomor tujuan, mis. 0812xxxxxxx"
            value={test.to}
            onChange={(e) => setTest({ ...test, to: e.target.value })}
            className="sm:w-48"
          />
          <Input
            required
            value={test.body}
            onChange={(e) => setTest({ ...test, body: e.target.value })}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={send.isPending} className="h-10">
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Kirim
          </Button>
        </div>
        {send.isSuccess && (
          <p className="text-xs text-emerald-600">
            Terkirim — channel ditandai terhubung.
          </p>
        )}
        {sendError && <p className="text-xs text-red-600">{sendError}</p>}
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
