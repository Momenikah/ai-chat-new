"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Braces,
  Info,
  Loader2,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import type {
  AudienceFilter,
  AudienceKind,
  Channel,
} from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CsvRow = NonNullable<AudienceFilter["csv_rows"]>[number];

export default function NewBroadcastPage() {
  const router = useRouter();
  const params = useSearchParams();
  const workspaceId = useWorkspaceStore((s) => s.currentId);

  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [bodyOverride, setBodyOverride] = useState("");
  const [audienceKind, setAudienceKind] = useState<AudienceKind>("all");
  const [tagId, setTagId] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [rate, setRate] = useState(60);
  const [launch, setLaunch] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");

  const channels = useQuery({
    queryKey: ["channels", workspaceId],
    queryFn: () => api.channels.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const tags = useQuery({
    queryKey: ["tags", workspaceId],
    queryFn: () => api.tags.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const segments = useQuery({
    queryKey: ["segments", workspaceId],
    queryFn: () => api.segments.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const templates = useQuery({
    queryKey: ["templates", workspaceId],
    queryFn: () => api.templates.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  /* ----------------------- Prefill from query ------------------------ */

  const fromCampaignId = params.get("from");
  const prefilledSegmentId = params.get("segment");
  const prefilledTagId = params.get("tag");

  const fromCampaign = useQuery({
    queryKey: ["broadcast", workspaceId, fromCampaignId],
    queryFn: () =>
      api.broadcasts.get(workspaceId as string, fromCampaignId as string),
    enabled: Boolean(workspaceId && fromCampaignId),
  });

  // Apply ?segment / ?tag once segments/tags are loaded.
  useEffect(() => {
    if (fromCampaignId) return; // ?from takes precedence
    if (prefilledSegmentId && segments.data) {
      const found = segments.data.segments.some(
        (s) => s.id === prefilledSegmentId,
      );
      if (found) {
        setAudienceKind("segment");
        setSegmentId(prefilledSegmentId);
      }
    }
    if (prefilledTagId && tags.data) {
      const found = tags.data.tags.some((t) => t.id === prefilledTagId);
      if (found) {
        setAudienceKind("tag");
        setTagId(prefilledTagId);
      }
    }
  }, [
    fromCampaignId,
    prefilledSegmentId,
    prefilledTagId,
    segments.data,
    tags.data,
  ]);

  // Apply ?from (duplicate from existing campaign).
  useEffect(() => {
    if (!fromCampaign.data) return;
    const c = fromCampaign.data.campaign;
    setName(`${c.name} (copy)`);
    setChannelId(c.channel_id);
    setTemplateId(c.template_id ?? "");
    setBodyOverride(c.body_override ?? "");
    setAudienceKind(c.audience_kind);
    setTagId(c.audience_filter.tag_id ?? "");
    setSegmentId(c.audience_filter.segment_id ?? "");
    setCsvRows(c.audience_filter.csv_rows ?? []);
    setRate(c.rate_per_minute);
  }, [fromCampaign.data]);

  /* ------------------------ Derived previews ------------------------ */

  const approvedTemplates = useMemo(
    () =>
      (templates.data?.templates ?? []).filter(
        (t) => t.status === "approved",
      ),
    [templates.data],
  );

  const selectedTemplate = useMemo(
    () => approvedTemplates.find((t) => t.id === templateId) ?? null,
    [approvedTemplates, templateId],
  );

  // Variables referenced in the active body (template or override).
  const bodySource = selectedTemplate?.body ?? bodyOverride;
  const detectedVariables = useMemo(
    () => extractVariables(bodySource ?? ""),
    [bodySource],
  );

  // Audience size preview. For "all"/"tag" we hit the contacts list endpoint.
  const allContacts = useQuery({
    queryKey: ["contacts", workspaceId, "", "", ""],
    queryFn: () => api.contacts.list(workspaceId as string, {}),
    enabled: Boolean(workspaceId) && audienceKind === "all",
    staleTime: 60_000,
  });

  const tagContacts = useQuery({
    queryKey: ["contacts", workspaceId, "", "", tagId],
    queryFn: () =>
      api.contacts.list(workspaceId as string, { tag: tagId }),
    enabled:
      Boolean(workspaceId) && audienceKind === "tag" && tagId.length > 0,
    staleTime: 60_000,
  });

  const audiencePreview = useMemo<{
    count: number | null;
    label: string;
  }>(() => {
    switch (audienceKind) {
      case "all":
        return {
          count: allContacts.data?.contacts.length ?? null,
          label: "kontak workspace",
        };
      case "tag":
        if (!tagId) return { count: null, label: "pilih tag dulu" };
        return {
          count: tagContacts.data?.contacts.length ?? null,
          label: "kontak ber-tag tsb.",
        };
      case "segment": {
        if (!segmentId) return { count: null, label: "pilih segment dulu" };
        const seg = segments.data?.segments.find((s) => s.id === segmentId);
        return {
          count: seg?.member_count ?? null,
          label: "anggota segment",
        };
      }
      case "csv":
        return { count: csvRows.length, label: "baris CSV" };
    }
  }, [
    audienceKind,
    allContacts.data,
    tagContacts.data,
    tagId,
    segmentId,
    segments.data,
    csvRows.length,
  ]);

  /* ----------------------------- Submit ----------------------------- */

  const audienceFilter: AudienceFilter = {};
  if (audienceKind === "tag" && tagId) audienceFilter.tag_id = tagId;
  if (audienceKind === "segment" && segmentId)
    audienceFilter.segment_id = segmentId;
  if (audienceKind === "csv") audienceFilter.csv_rows = csvRows;

  const createAndLaunch = useMutation({
    mutationFn: async () => {
      const camp = await api.broadcasts.create(workspaceId as string, {
        name,
        channel_id: channelId,
        template_id: templateId || undefined,
        audience_kind: audienceKind,
        audience_filter: audienceFilter,
        body_override: bodyOverride || undefined,
        rate_per_minute: rate,
      });
      if (launch || scheduledAt) {
        await api.broadcasts.schedule(workspaceId as string, camp.id, {
          scheduled_at: scheduledAt || new Date().toISOString(),
          launch: launch,
        });
      }
      return camp;
    },
    onSuccess: (c) => router.push(`/dashboard/broadcasts/${c.id}`),
  });

  const error =
    createAndLaunch.error instanceof ApiException
      ? createAndLaunch.error.message
      : null;

  /* ------------------------------ Render --------------------------- */

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <div>
        <Link
          href="/dashboard/broadcasts"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke broadcast
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          {fromCampaignId ? "Duplicate campaign" : "Campaign baru"}
        </h1>
        {fromCampaignId && (
          <p className="mt-1 text-xs text-muted-foreground">
            Pre-filled dari campaign yang ada. Edit sesuai kebutuhan sebelum
            simpan.
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detail</CardTitle>
          <CardDescription>
            Pilih channel, audience, dan template; worker akan mengirim
            mengikuti rate limit yang Anda set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createAndLaunch.mutate();
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="b-name">Nama campaign</Label>
              <Input
                id="b-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Promo Lebaran 2026"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="b-channel">Channel</Label>
                <Select
                  id="b-channel"
                  required
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                >
                  <option value="">— pilih channel —</option>
                  {(channels.data?.channels ?? []).map((c: Channel) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-rate">Rate per menit</Label>
                <Input
                  id="b-rate"
                  type="number"
                  min={1}
                  max={600}
                  value={rate}
                  onChange={(e) => setRate(parseInt(e.target.value) || 60)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Audience</Label>
              <div className="grid grid-cols-4 gap-2">
                {(["all", "tag", "segment", "csv"] as AudienceKind[]).map(
                  (k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setAudienceKind(k)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-all ${
                        audienceKind === k
                          ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900"
                          : "border-border hover:border-zinc-300"
                      }`}
                    >
                      {k}
                    </button>
                  ),
                )}
              </div>
              {audienceKind === "tag" && (
                <Select
                  value={tagId}
                  onChange={(e) => setTagId(e.target.value)}
                >
                  <option value="">— pilih tag —</option>
                  {(tags.data?.tags ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              )}
              {audienceKind === "segment" && (
                <Select
                  value={segmentId}
                  onChange={(e) => setSegmentId(e.target.value)}
                >
                  <option value="">— pilih segment —</option>
                  {(segments.data?.segments ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.member_count})
                    </option>
                  ))}
                </Select>
              )}
              {audienceKind === "csv" && (
                <CsvUpload rows={csvRows} onChange={setCsvRows} />
              )}

              <AudiencePreview
                count={audiencePreview.count}
                label={audiencePreview.label}
                loading={
                  (audienceKind === "all" && allContacts.isLoading) ||
                  (audienceKind === "tag" &&
                    Boolean(tagId) &&
                    tagContacts.isLoading)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="b-template">Template (opsional)</Label>
              <Select
                id="b-template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">— gunakan teks bebas —</option>
                {approvedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.language})
                  </option>
                ))}
              </Select>
              {!templateId && (
                <textarea
                  rows={4}
                  required={!templateId}
                  value={bodyOverride}
                  onChange={(e) => setBodyOverride(e.target.value)}
                  placeholder="Halo {{name}}, ada promo spesial buat kamu…"
                  className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                />
              )}

              <VariableDetector
                variables={detectedVariables}
                audienceKind={audienceKind}
                csvRows={csvRows}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="b-schedule">Schedule (opsional)</Label>
                <Input
                  id="b-schedule"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => {
                    setScheduledAt(e.target.value);
                    if (e.target.value) setLaunch(false);
                  }}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={launch}
                    onChange={(e) => setLaunch(e.target.checked)}
                  />
                  Launch sekarang
                </label>
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/broadcasts">Batal</Link>
              </Button>
              <Button type="submit" disabled={createAndLaunch.isPending}>
                {createAndLaunch.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {launch
                  ? "Simpan & launch"
                  : scheduledAt
                    ? "Simpan & schedule"
                    : "Simpan draft"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ------------------------- Audience preview --------------------------- */

function AudiencePreview({
  count,
  label,
  loading,
}: {
  count: number | null;
  label: string;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-zinc-50/60 px-3 py-2 text-xs">
      <Users className="h-3.5 w-3.5 text-zinc-500" />
      <span className="text-muted-foreground">Estimasi penerima:</span>
      <span className="font-semibold text-zinc-900">
        {loading
          ? "menghitung…"
          : count === null
            ? "—"
            : count.toLocaleString("id-ID")}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

/* ------------------------- Variable detector ------------------------- */

function VariableDetector({
  variables,
  audienceKind,
  csvRows,
}: {
  variables: string[];
  audienceKind: AudienceKind;
  csvRows: CsvRow[];
}) {
  const csvColumns = useMemo(() => {
    if (audienceKind !== "csv" || csvRows.length === 0) return null;
    const cols = new Set<string>();
    for (const row of csvRows.slice(0, 50)) {
      if (row.variables) {
        for (const k of Object.keys(row.variables)) cols.add(k);
      }
    }
    if (csvRows.some((r) => r.name)) cols.add("name");
    if (csvRows.some((r) => r.phone)) cols.add("phone");
    return cols;
  }, [audienceKind, csvRows]);

  if (variables.length === 0) return null;

  const builtin = new Set(["name", "phone", "email"]);

  return (
    <div className="space-y-1.5 rounded-lg border border-dashed border-border bg-violet-50/40 px-3 py-2 text-xs">
      <div className="flex items-center gap-2 text-violet-900">
        <Braces className="h-3.5 w-3.5" />
        <span className="font-medium">
          {variables.length} variable terdeteksi
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {variables.map((v) => {
          const fromCsv = csvColumns?.has(v);
          const fromContact = builtin.has(v);
          const ok = audienceKind === "csv" ? fromCsv : fromContact || fromCsv;
          return (
            <span
              key={v}
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono ${
                ok
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
              title={
                ok
                  ? "Tersedia dari sumber audience"
                  : "Tidak terlihat di data audience — kemungkinan kosong saat dikirim"
              }
            >
              {`{{${v}}}`}
            </span>
          );
        })}
      </div>
      <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        {audienceKind === "csv"
          ? "Variable disuplai dari kolom CSV (header tepat sama). Hijau = terdeteksi, kuning = belum ada di file."
          : "Variable diisi dari field kontak (name/phone/email) atau variable CSV. Hijau = bisa di-render, kuning = perlu dipastikan."}
        {variables.length > 0 && (
          <span className="ml-1">
            <Sparkles className="inline h-3 w-3 text-violet-500" />
          </span>
        )}
      </p>
    </div>
  );
}

function extractVariables(text: string): string[] {
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(m[1]);
  return Array.from(out);
}

/* ------------------------------ CSV --------------------------------- */

function CsvUpload({
  rows,
  onChange,
}: {
  rows: CsvRow[];
  onChange: (next: CsvRow[]) => void;
}) {
  async function handleFile(f: File) {
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return;
    const header = splitCsv(lines[0]).map((h) => h.trim().toLowerCase());
    const idx = (key: string) => header.indexOf(key);
    const out: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = splitCsv(lines[i]);
      const phone = idx("phone") >= 0 ? cells[idx("phone")] : "";
      const name = idx("name") >= 0 ? cells[idx("name")] : "";
      const externalID =
        idx("external_id") >= 0 ? cells[idx("external_id")] : "";
      const variables: Record<string, string> = {};
      header.forEach((col, j) => {
        if (["phone", "name", "external_id"].includes(col)) return;
        if (cells[j]) variables[col] = cells[j];
      });
      out.push({
        name: name || undefined,
        phone: phone || undefined,
        external_id: externalID || undefined,
        variables,
      });
    }
    onChange(out);
  }

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 px-3 py-2 text-sm hover:border-zinc-400">
        <Upload className="h-4 w-4" />
        {rows.length > 0
          ? `${rows.length} baris dimuat — pilih file lain untuk ganti`
          : "Upload CSV (kolom: phone,name,external_id,...variable)"}
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>
      {rows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Preview:{" "}
          {rows
            .slice(0, 3)
            .map((r) => r.phone ?? r.name ?? "?")
            .join(", ")}
          …
        </p>
      )}
    </div>
  );
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else if (ch === '"') q = true;
    else cur += ch;
  }
  out.push(cur);
  return out;
}
