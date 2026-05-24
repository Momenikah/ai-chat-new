"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import type { ChannelType } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
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
import { CHANNEL_META } from "@/components/channels/channel-meta";

interface CredField {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
}

const CREDENTIAL_FIELDS: Record<ChannelType, CredField[]> = {
  whatsapp: [
    { key: "phone_number_id", label: "Phone Number ID", placeholder: "1029384756" },
    { key: "business_account_id", label: "Business Account ID", placeholder: "5647382910" },
    { key: "access_token", label: "Access Token", placeholder: "EAAG…", secret: true },
    {
      key: "webhook_verify_token",
      label: "Webhook Verify Token (opsional)",
      placeholder: "isi sesuai Meta dashboard",
    },
  ],
  instagram: [
    { key: "page_id", label: "Instagram Page ID", placeholder: "17841400000000000" },
    { key: "access_token", label: "Access Token", placeholder: "IGQVJ…", secret: true },
  ],
  messenger: [
    { key: "page_id", label: "Facebook Page ID", placeholder: "612345678901234" },
    { key: "page_access_token", label: "Page Access Token", placeholder: "EAAG…", secret: true },
    { key: "app_secret", label: "App Secret", placeholder: "••••••••", secret: true },
  ],
};

const TYPES: ChannelType[] = ["whatsapp", "instagram", "messenger"];

export default function NewChannelPage() {
  const router = useRouter();
  const currentId = useWorkspaceStore((s) => s.currentId);

  const [type, setType] = useState<ChannelType>("whatsapp");
  const [name, setName] = useState("");
  const [creds, setCreds] = useState<Record<string, string>>({});

  const fields = CREDENTIAL_FIELDS[type];

  const mutation = useMutation({
    mutationFn: async () => {
      const collect = () => {
        const out: Record<string, string> = {};
        for (const f of fields) {
          const v = creds[`${type}.${f.key}`]?.trim();
          if (v) out[f.key] = v;
        }
        return out;
      };

      // WhatsApp goes through the dedicated Meta Cloud API connect endpoint
      // so the channel is registered for incoming webhooks.
      if (type === "whatsapp") {
        const c = collect();
        const res = await api.whatsapp.connect(currentId as string, {
          name: name.trim(),
          phone_number_id: c.phone_number_id ?? "",
          business_account_id: c.business_account_id,
          access_token: c.access_token ?? "",
          webhook_verify_token: c.webhook_verify_token,
        });
        return { channel: res.channel, webhook_url: res.webhook_url };
      }

      const credentials = collect();
      const channel = await api.channels.create(currentId as string, {
        type,
        name: name.trim(),
        credentials:
          Object.keys(credentials).length > 0 ? credentials : undefined,
      });
      return { channel, webhook_url: null };
    },
    onSuccess: (result) => {
      if (type === "whatsapp" && result.webhook_url) {
        // Stay on page so the user can copy webhook URL into Meta dashboard.
        setConnected(result.webhook_url);
        return;
      }
      router.push("/dashboard/channels");
    },
  });

  const [connected, setConnected] = useState<string | null>(null);

  const error =
    mutation.error instanceof ApiException ? mutation.error.message : null;

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
          Tambah channel
        </h1>
        <p className="text-sm text-muted-foreground">
          Pilih platform lalu masukkan credential dari penyedia.
        </p>
      </div>

      {/* Type picker — Instagram & Messenger have dedicated connect pages */}
      <div className="grid gap-3 sm:grid-cols-3">
        {TYPES.map((t) => {
          const meta = CHANNEL_META[t];
          const Icon = meta.icon;
          const active = t === type;
          const handleClick = () => {
            if (t === "instagram") {
              router.push("/dashboard/channels/instagram");
              return;
            }
            if (t === "messenger") {
              router.push("/dashboard/channels/messenger");
              return;
            }
            setType(t);
          };
          return (
            <button
              key={t}
              type="button"
              onClick={handleClick}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border bg-white p-4 text-center transition-all",
                active
                  ? "border-zinc-900 ring-1 ring-zinc-900"
                  : "border-border hover:border-zinc-300",
              )}
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                style={{ background: meta.color }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium">{meta.label}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{CHANNEL_META[type].label}</CardTitle>
          <CardDescription>
            Beri nama channel dan masukkan credential koneksi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="ch-name">Nama channel</Label>
              <Input
                id="ch-name"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="WhatsApp Customer Support"
              />
            </div>

            <motion.div
              key={type}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {fields.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <Input
                    id={f.key}
                    type={f.secret ? "password" : "text"}
                    placeholder={f.placeholder}
                    value={creds[`${type}.${f.key}`] ?? ""}
                    onChange={(e) =>
                      setCreds((c) => ({
                        ...c,
                        [`${type}.${f.key}`]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </motion.div>

            <p className="flex items-start gap-1.5 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Credential dienkripsi (AES-256-GCM) sebelum disimpan dan tidak
              pernah ditampilkan kembali dalam bentuk asli.
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
                {type === "whatsapp" ? "Hubungkan ke Meta" : "Simpan channel"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <ShieldCheck className="h-5 w-5" /> Channel WhatsApp terhubung
            </CardTitle>
            <CardDescription>
              Salin URL webhook + verify token ini ke Meta App Dashboard →
              WhatsApp → Configuration untuk menerima pesan masuk.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CopyRow label="Callback URL" value={connected} />
            <CopyRow
              label="Verify Token"
              value={
                creds[`whatsapp.webhook_verify_token`] ||
                "dev-whatsapp-verify-token (lihat .env)"
              }
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" asChild>
                <Link href="/dashboard/channels">Selesai</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const copy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(value).catch(() => {});
    }
  };
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-zinc-50 px-3 py-2">
        <code className="flex-1 truncate text-xs">{value}</code>
        <button
          onClick={copy}
          className="rounded-md px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Salin
        </button>
      </div>
    </div>
  );
}
