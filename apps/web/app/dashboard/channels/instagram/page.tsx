"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  ArrowLeft,
  CheckCircle2,
  Instagram,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import type { Channel } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
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
import {
  ConnectedAccountCard,
  CopyRow,
} from "@/components/channels/meta-channel-card";

export default function ConnectInstagramPage() {
  const workspaceId = useWorkspaceStore((s) => s.currentId);

  const infoQuery = useQuery({
    queryKey: ["instagram", "info", workspaceId],
    queryFn: () => api.instagram.info(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const channelsQuery = useQuery({
    queryKey: ["channels", workspaceId],
    queryFn: () => api.channels.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const connected = (channelsQuery.data?.channels ?? []).filter(
    (c) => c.type === "instagram",
  );

  const [form, setForm] = useState({
    name: "Instagram DM",
    instagram_business_id: "",
    page_id: "",
    page_access_token: "",
    webhook_verify_token: "",
  });

  const [result, setResult] = useState<{
    channel: Channel;
    webhook_url: string;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.instagram.connect(workspaceId as string, {
        name: form.name,
        instagram_business_id: form.instagram_business_id,
        page_id: form.page_id || undefined,
        page_access_token: form.page_access_token,
        webhook_verify_token: form.webhook_verify_token || undefined,
      }),
    onSuccess: (data) => {
      setResult(data);
      channelsQuery.refetch();
    },
  });

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
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
            style={{ background: "#E1306C" }}
          >
            <Instagram className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Connect Instagram DM
            </h1>
            <p className="text-sm text-muted-foreground">
              Hubungkan akun Instagram Business via Meta Messenger Platform.
            </p>
          </div>
        </div>
      </div>

      {connected.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Akun terhubung
          </p>
          {connected.map((c) => (
            <ConnectedAccountCard
              key={c.id}
              channel={c}
              externalLabel="IG Business ID"
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Hubungkan akun baru</CardTitle>
          <CardDescription>
            Akses token diperoleh dari Facebook Page yang ter-link ke akun
            Instagram Business. Lihat README untuk panduan lengkap.
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
              id="ig-name"
              label="Nama channel"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
            />
            <Field
              id="ig-business-id"
              label="Instagram Business Account ID"
              placeholder="17841400000000000"
              value={form.instagram_business_id}
              onChange={(v) => setForm({ ...form, instagram_business_id: v })}
              required
            />
            <Field
              id="ig-page-id"
              label="Linked Facebook Page ID (opsional)"
              placeholder="612345678901234"
              value={form.page_id}
              onChange={(v) => setForm({ ...form, page_id: v })}
            />
            <Field
              id="ig-token"
              label="Page Access Token"
              placeholder="EAAG…"
              type="password"
              value={form.page_access_token}
              onChange={(v) => setForm({ ...form, page_access_token: v })}
              required
            />
            <Field
              id="ig-verify"
              label="Webhook Verify Token (opsional)"
              placeholder="isi sesuai Meta dashboard"
              value={form.webhook_verify_token}
              onChange={(v) => setForm({ ...form, webhook_verify_token: v })}
            />

            <p className="flex items-start gap-1.5 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Credential dienkripsi AES-256-GCM sebelum disimpan dan tidak
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
                Hubungkan ke Meta
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" /> Channel Instagram terhubung
            </CardTitle>
            <CardDescription>
              Salin URL webhook + verify token ke Meta App Dashboard →
              Instagram → Webhooks → field <code>messages</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CopyRow label="Callback URL" value={result.webhook_url} />
            <CopyRow
              label="Verify Token"
              value={
                form.webhook_verify_token ||
                infoQuery.data?.webhook_url
                  ? form.webhook_verify_token ||
                    "dev-instagram-verify-token (lihat .env)"
                  : "dev-instagram-verify-token (lihat .env)"
              }
            />
          </CardContent>
        </Card>
      )}
    </motion.div>
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
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
    </div>
  );
}
