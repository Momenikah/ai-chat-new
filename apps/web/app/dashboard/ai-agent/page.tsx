"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Bot,
  Check,
  CheckCircle2,
  Loader2,
  Shield,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { AIAgent, AIPromptReview, Channel } from "@aichat/shared";
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
import { Skeleton } from "@/components/ui/skeleton";
import { AgentStatusBanner } from "@/components/ai-agent/agent-status-banner";
import { InlinePlayground } from "@/components/ai-agent/inline-playground";
import { BotLogsPanel } from "@/components/ai-agent/bot-logs-panel";
import { PROMPT_PRESETS } from "@/components/ai-agent/prompt-presets";

const PROMPT_LIMIT = 4000;
const PROMPT_VARS = ["name", "brand", "phone", "company"];

const TONES = [
  "profesional dan ramah",
  "santai dan akrab",
  "formal dan singkat",
  "antusias dan persuasif",
];

const LANGUAGES = [
  { value: "id", label: "Bahasa Indonesia" },
  { value: "en", label: "English" },
];

export default function AIAgentPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const can = useWorkspaceStore((s) => s.can);
  const canEdit = can("ADMIN");

  const agentQ = useQuery({
    queryKey: ["ai-agent", workspaceId],
    queryFn: () => api.aiAgent.get(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const channelsQ = useQuery({
    queryKey: ["channels", workspaceId],
    queryFn: () => api.channels.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const reviewsQ = useQuery({
    queryKey: ["ai-agent-reviews", workspaceId],
    queryFn: () => api.aiAgent.reviews(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const knowledgeQ = useQuery({
    queryKey: ["knowledge", workspaceId],
    queryFn: () => api.knowledge.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  // Local mirror of the prompt being edited so the inline playground can test
  // unsaved changes without round-tripping through the server.
  const [draftPrompt, setDraftPrompt] = useState("");
  useEffect(() => {
    if (agentQ.data) setDraftPrompt(agentQ.data.system_prompt);
  }, [agentQ.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["ai-agent", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["ai-agent-reviews", workspaceId] });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">AI Chatbot</h1>
          <p className="text-sm text-muted-foreground">
            Setel kepribadian, batas keyakinan, dan handoff agent AI per workspace.
            Setiap perubahan harus disetujui ulang sebelum bot membalas.
          </p>
        </div>
      </div>

      {agentQ.isLoading ? (
        <Skeleton className="h-[200px] rounded-xl" />
      ) : agentQ.data ? (
        <AgentStatusBanner
          agent={agentQ.data}
          channels={channelsQ.data?.channels ?? []}
          knowledgeCount={knowledgeQ.data?.documents.length ?? null}
        />
      ) : null}

      {agentQ.isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : agentQ.data ? (
        <AgentForm
          workspaceId={workspaceId as string}
          agent={agentQ.data}
          channels={channelsQ.data?.channels ?? []}
          canEdit={canEdit}
          onSaved={invalidate}
          onPromptChange={setDraftPrompt}
        />
      ) : null}

      {agentQ.data && workspaceId && (
        <InlinePlayground
          workspaceId={workspaceId}
          systemPrompt={draftPrompt}
        />
      )}

      {agentQ.data && (
        <ApprovalCard
          workspaceId={workspaceId as string}
          agent={agentQ.data}
          canEdit={canEdit}
          onChanged={invalidate}
        />
      )}

      {workspaceId && <BotLogsPanel workspaceId={workspaceId} />}

      <ReviewsCard reviews={reviewsQ.data?.reviews ?? []} loading={reviewsQ.isLoading} />
    </motion.div>
  );
}

function AgentForm({
  workspaceId,
  agent,
  channels,
  canEdit,
  onSaved,
  onPromptChange,
}: {
  workspaceId: string;
  agent: AIAgent;
  channels: Channel[];
  canEdit: boolean;
  onSaved: () => void;
  onPromptChange?: (prompt: string) => void;
}) {
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [form, setForm] = useState({
    name: agent.name,
    tone: agent.tone,
    language: agent.language,
    system_prompt: agent.system_prompt,
    fallback_message: agent.fallback_message,
    confidence_threshold: agent.confidence_threshold,
    enabled: agent.enabled,
    handoff_enabled: agent.handoff_enabled,
    model: agent.model,
    embedding_model: agent.embedding_model,
    enabled_channel_ids: agent.enabled_channel_ids ?? [],
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({
      name: agent.name,
      tone: agent.tone,
      language: agent.language,
      system_prompt: agent.system_prompt,
      fallback_message: agent.fallback_message,
      confidence_threshold: agent.confidence_threshold,
      enabled: agent.enabled,
      handoff_enabled: agent.handoff_enabled,
      model: agent.model,
      embedding_model: agent.embedding_model,
      enabled_channel_ids: agent.enabled_channel_ids ?? [],
    });
  }, [agent]);

  const mutation = useMutation({
    mutationFn: () => api.aiAgent.update(workspaceId, form),
    onSuccess: () => {
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 1800);
    },
  });

  const err = mutation.error instanceof ApiException ? mutation.error.message : null;
  const toggleChannel = (id: string) =>
    setForm((f) => ({
      ...f,
      enabled_channel_ids: f.enabled_channel_ids.includes(id)
        ? f.enabled_channel_ids.filter((x) => x !== id)
        : [...f.enabled_channel_ids, id],
    }));

  function setPrompt(value: string) {
    setForm((f) => ({ ...f, system_prompt: value }));
    onPromptChange?.(value);
  }

  function insertPromptVar(name: string) {
    const ta = promptRef.current;
    const token = `{{${name}}}`;
    if (!ta) {
      setPrompt(form.system_prompt + token);
      return;
    }
    const start = ta.selectionStart ?? form.system_prompt.length;
    const end = ta.selectionEnd ?? form.system_prompt.length;
    const next =
      form.system_prompt.slice(0, start) + token + form.system_prompt.slice(end);
    setPrompt(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  const promptOver = form.system_prompt.length > PROMPT_LIMIT;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kepribadian agent</CardTitle>
        <CardDescription>
          Disimpan per workspace. Menyimpan akan mereset persetujuan prompt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-name">Nama agent</Label>
              <Input
                id="ai-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-tone">Nada bicara</Label>
              <Select
                id="ai-tone"
                value={form.tone}
                onChange={(e) => setForm({ ...form, tone: e.target.value })}
                disabled={!canEdit}
              >
                {TONES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-lang">Bahasa</Label>
              <Select
                id="ai-lang"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                disabled={!canEdit}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-conf">
                Confidence threshold ({form.confidence_threshold.toFixed(2)})
              </Label>
              <input
                id="ai-conf"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={form.confidence_threshold}
                onChange={(e) =>
                  setForm({ ...form, confidence_threshold: Number(e.target.value) })
                }
                disabled={!canEdit}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Jika jawaban di bawah ambang ini, bot akan handoff ke agent manusia.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="ai-prompt">System prompt</Label>
              <span
                className={
                  promptOver
                    ? "text-[11px] font-semibold text-red-600"
                    : "text-[11px] tabular-nums text-muted-foreground"
                }
              >
                {form.system_prompt.length} / {PROMPT_LIMIT}
              </span>
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-violet-500" /> Preset:
                </span>
                {PROMPT_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPrompt(p.prompt)}
                    className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] hover:bg-zinc-50"
                    title="Ganti system prompt dengan preset ini"
                  >
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>
            )}

            <textarea
              ref={promptRef}
              id="ai-prompt"
              rows={6}
              required
              value={form.system_prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={!canEdit}
              className={`w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-60 ${
                promptOver ? "border-red-300" : "border-input"
              }`}
            />

            {canEdit && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">
                  Sisipkan variabel:
                </span>
                {PROMPT_VARS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertPromptVar(v)}
                    className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[11px] hover:bg-zinc-50"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-fb">Pesan fallback (saat handoff)</Label>
            <textarea
              id="ai-fb"
              rows={2}
              value={form.fallback_message}
              onChange={(e) => setForm({ ...form, fallback_message: e.target.value })}
              disabled={!canEdit}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-60"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-model">Chat model</Label>
              <Input
                id="ai-model"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-embed">Embedding model</Label>
              <Input
                id="ai-embed"
                value={form.embedding_model}
                onChange={(e) =>
                  setForm({ ...form, embedding_model: e.target.value })
                }
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Mengubah ini setelah ingest = perlu re-index knowledge base.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-lg border border-input p-3">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                disabled={!canEdit}
                className="h-4 w-4"
              />
              <div>
                <p className="text-sm font-medium">Aktifkan bot</p>
                <p className="text-xs text-muted-foreground">
                  Bot hanya akan membalas jika prompt sudah disetujui.
                </p>
              </div>
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-input p-3">
              <input
                type="checkbox"
                checked={form.handoff_enabled}
                onChange={(e) =>
                  setForm({ ...form, handoff_enabled: e.target.checked })
                }
                disabled={!canEdit}
                className="h-4 w-4"
              />
              <div>
                <p className="text-sm font-medium">Handoff otomatis</p>
                <p className="text-xs text-muted-foreground">
                  Set conversation ke pending jika confidence di bawah ambang.
                </p>
              </div>
            </label>
          </div>

          <div className="space-y-2">
            <Label>Channel yang menerima auto-reply</Label>
            <div className="space-y-2">
              {channels.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Belum ada channel yang terhubung.
                </p>
              )}
              {channels.map((c) => {
                const checked = form.enabled_channel_ids.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border border-input p-2"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleChannel(c.id)}
                      disabled={!canEdit}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">
                      {c.name}{" "}
                      <span className="text-muted-foreground">({c.type})</span>
                    </span>
                  </label>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Kosongkan untuk mengaktifkan di semua channel.
              </p>
            </div>
          </div>

          {err && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {err}
            </p>
          )}

          {canEdit && (
            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {saved && !mutation.isPending && <Check className="h-4 w-4" />}
                Simpan
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function ApprovalCard({
  workspaceId,
  agent,
  canEdit,
  onChanged,
}: {
  workspaceId: string;
  agent: AIAgent;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState("");
  const approve = useMutation({
    mutationFn: () => api.aiAgent.approve(workspaceId, notes.trim() || undefined),
    onSuccess: () => {
      onChanged();
      setNotes("");
    },
  });
  const reject = useMutation({
    mutationFn: () => api.aiAgent.reject(workspaceId, notes.trim() || undefined),
    onSuccess: () => {
      onChanged();
      setNotes("");
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Review prompt</CardTitle>
            <CardDescription>
              Bot tidak akan mengirim balasan otomatis tanpa persetujuan terbaru.
            </CardDescription>
          </div>
          {agent.prompt_approved ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <Shield className="h-3.5 w-3.5" /> Approved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              <ShieldAlert className="h-3.5 w-3.5" /> Belum disetujui
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {canEdit ? (
          <div className="space-y-3">
            <textarea
              rows={2}
              placeholder="Catatan review (opsional)…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => reject.mutate()}
                disabled={reject.isPending}
              >
                {reject.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Tolak
              </Button>
              <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
                {approve.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Setujui
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Hanya admin yang dapat menyetujui atau menolak prompt.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewsCard({
  reviews,
  loading,
}: {
  reviews: AIPromptReview[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat review</CardTitle>
        <CardDescription>50 review terakhir.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada review.</p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-input bg-zinc-50/40 p-3"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span
                    className={
                      r.status === "approved"
                        ? "font-medium text-emerald-700"
                        : r.status === "rejected"
                          ? "font-medium text-red-700"
                          : "font-medium text-amber-700"
                    }
                  >
                    {r.status.toUpperCase()}
                  </span>
                  <span>{new Date(r.created_at).toLocaleString("id-ID")}</span>
                </div>
                {r.notes && (
                  <p className="mt-1 text-sm">{r.notes}</p>
                )}
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {r.prompt}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
