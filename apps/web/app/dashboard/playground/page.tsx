"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  AlertTriangle,
  Bot,
  Columns2,
  Download,
  FlaskConical,
  Loader2,
  Sparkles,
  Trash2,
  User as UserIcon,
  Wand2,
} from "lucide-react";
import type { PlaygroundResult } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PROMPT_PRESETS } from "@/components/ai-agent/prompt-presets";

const PROMPT_LIMIT = 4000;

const SAMPLE_QUESTIONS = [
  "Berapa lama pengiriman ke Surabaya?",
  "Apakah bisa retur kalau ukuran tidak pas?",
  "Jam operasional toko berapa?",
  "Ada promo apa minggu ini?",
  "Bagaimana cara melacak pesanan saya?",
  "Metode pembayaran apa saja yang diterima?",
];

interface Side {
  result?: PlaygroundResult;
  error?: string;
  pending: boolean;
}

interface Turn {
  id: string;
  user: string;
  compare: boolean;
  a: Side; // agent prompt (compare) / override-or-agent (single)
  b?: Side; // override (compare only)
}

export default function PlaygroundPage() {
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const [message, setMessage] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [compare, setCompare] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);

  const agentQ = useQuery({
    queryKey: ["ai-agent", workspaceId],
    queryFn: () => api.aiAgent.get(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const threshold = agentQ.data?.confidence_threshold ?? null;

  const run = (input: { message: string; system_prompt?: string }) =>
    api.ai.playground(workspaceId as string, input);

  const busy = turns.some((t) => t.a.pending || t.b?.pending);

  async function send(text?: string) {
    const value = (text ?? message).trim();
    if (!value || !workspaceId || busy) return;
    const id = crypto.randomUUID();
    const override = systemPrompt.trim() || undefined;

    if (compare) {
      setTurns((t) => [
        ...t,
        { id, user: value, compare: true, a: { pending: true }, b: { pending: true } },
      ]);
      setMessage("");
      // A = agent's saved prompt (no override). B = override draft.
      void resolveSide(id, "a", run({ message: value }));
      void resolveSide(id, "b", run({ message: value, system_prompt: override }));
    } else {
      setTurns((t) => [
        ...t,
        { id, user: value, compare: false, a: { pending: true } },
      ]);
      setMessage("");
      void resolveSide(id, "a", run({ message: value, system_prompt: override }));
    }
  }

  async function resolveSide(
    id: string,
    side: "a" | "b",
    promise: Promise<PlaygroundResult>,
  ) {
    try {
      const result = await promise;
      patchSide(id, side, { result, pending: false });
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : "Gagal menjalankan";
      patchSide(id, side, { error: msg, pending: false });
    }
  }

  function patchSide(id: string, side: "a" | "b", value: Side) {
    setTurns((t) =>
      t.map((x) => (x.id === id ? { ...x, [side]: value } : x)),
    );
  }

  function exportTranscript() {
    if (turns.length === 0) return;
    const lines: string[] = [`# AI Playground transcript`, ""];
    for (const t of turns) {
      lines.push(`## Pelanggan: ${t.user}`);
      if (t.compare) {
        lines.push(
          `- [A · prompt agent] ${sideText(t.a)}`,
          `- [B · override] ${sideText(t.b)}`,
        );
      } else {
        lines.push(sideText(t.a));
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `playground-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const promptOver = systemPrompt.length > PROMPT_LIMIT;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_22rem]"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                AI Playground
              </h1>
              <p className="text-sm text-muted-foreground">
                Uji jawaban agent + knowledge tanpa mengirim apapun ke pelanggan.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCompare((c) => !c)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
                compare
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
              )}
              title="Bandingkan prompt agent vs override"
            >
              <Columns2 className="h-3.5 w-3.5" /> Compare
            </button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={exportTranscript}
              disabled={turns.length === 0}
              aria-label="Export transkrip"
              title="Export transkrip"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-red-600 hover:bg-red-50"
              onClick={() => setTurns([])}
              disabled={turns.length === 0}
              aria-label="Bersihkan chat"
              title="Bersihkan chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <Card className="min-h-[26rem]">
          <CardContent className="space-y-4 p-4">
            {turns.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
                <Sparkles className="h-8 w-8 text-zinc-400" />
                <p>Mulai dengan pertanyaan dari sudut pandang pelanggan.</p>
                <div className="flex max-w-md flex-wrap justify-center gap-1.5">
                  {SAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void send(q)}
                      className="rounded-full border border-border bg-white px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              turns.map((t) => (
                <TurnBubble key={t.id} turn={t} threshold={threshold} />
              ))
            )}
          </CardContent>
        </Card>

        {turns.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center text-xs text-muted-foreground">
              Contoh:
            </span>
            {SAMPLE_QUESTIONS.slice(0, 4).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void send(q)}
                disabled={busy}
                className="rounded-full border border-border bg-white px-2.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Misal: berapa lama pengiriman ke Surabaya?"
            className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button type="submit" disabled={busy || !message.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim"}
          </Button>
        </form>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  System prompt {compare ? "(B · override)" : "override"}
                </CardTitle>
                <CardDescription>
                  {compare
                    ? "Mode compare: A pakai prompt agent, B pakai teks ini."
                    : "Kosongkan untuk pakai prompt agent saat ini."}
                </CardDescription>
              </div>
              <span
                className={cn(
                  "shrink-0 text-[11px] tabular-nums",
                  promptOver
                    ? "font-semibold text-red-600"
                    : "text-muted-foreground",
                )}
              >
                {systemPrompt.length}/{PROMPT_LIMIT}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setSystemPrompt(agentQ.data?.system_prompt ?? "")
                }
                disabled={!agentQ.data}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] hover:bg-zinc-50 disabled:opacity-40"
              >
                <Wand2 className="h-3 w-3" /> Muat prompt agent
              </button>
              {PROMPT_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSystemPrompt(p.prompt)}
                  className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] hover:bg-zinc-50"
                  title={p.label}
                >
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
            <Label htmlFor="pl-sp" className="sr-only">
              System prompt
            </Label>
            <textarea
              id="pl-sp"
              rows={10}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Tulis variasi prompt yang ingin diuji…"
              className={cn(
                "w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                promptOver ? "border-red-300" : "border-input",
              )}
            />
            {threshold !== null && (
              <p className="text-[11px] text-muted-foreground">
                Ambang handoff agent:{" "}
                <span className="font-medium text-zinc-700">
                  {threshold.toFixed(2)}
                </span>
                . Jawaban di bawah ini akan handoff.
              </p>
            )}
          </CardContent>
        </Card>
      </aside>
    </motion.div>
  );
}

function sideText(side?: Side): string {
  if (!side) return "—";
  if (side.error) return `(error: ${side.error})`;
  return side.result?.response ?? "—";
}

function TurnBubble({
  turn,
  threshold,
}: {
  turn: Turn;
  threshold: number | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="flex max-w-[80%] items-start gap-2">
          <div className="rounded-2xl rounded-tr-sm bg-zinc-900 px-3 py-2 text-sm text-white">
            {turn.user}
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200">
            <UserIcon className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>

      {turn.compare ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <SideBubble label="A · Prompt agent" side={turn.a} threshold={threshold} />
          <SideBubble label="B · Override" side={turn.b} threshold={threshold} highlight />
        </div>
      ) : (
        <div className="flex">
          <div className="flex max-w-[80%] items-start gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-2">
              <BubbleBody side={turn.a} />
              {turn.a.result && (
                <ResultMeta result={turn.a.result} threshold={threshold} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SideBubble({
  label,
  side,
  threshold,
  highlight,
}: {
  label: string;
  side?: Side;
  threshold: number | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-xl border p-3",
        highlight ? "border-violet-200 bg-violet-50/40" : "border-border",
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        <Bot className="h-3 w-3" /> {label}
      </div>
      <BubbleBody side={side} />
      {side?.result && <ResultMeta result={side.result} threshold={threshold} />}
    </div>
  );
}

function BubbleBody({ side }: { side?: Side }) {
  return (
    <div className="rounded-2xl rounded-tl-sm bg-zinc-100 px-3 py-2 text-sm text-zinc-900">
      {!side || side.pending ? (
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Menghasilkan…
        </span>
      ) : side.error ? (
        <span className="text-red-600">{side.error}</span>
      ) : (
        side.result?.response
      )}
    </div>
  );
}

function ResultMeta({
  result,
  threshold,
}: {
  result: PlaygroundResult;
  threshold: number | null;
}) {
  return (
    <div className="space-y-1.5 text-xs text-muted-foreground">
      <ConfidenceBar value={result.confidence} threshold={threshold} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono">
          {result.model}
        </span>
        {result.would_handoff && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-700">
            <AlertTriangle className="h-3 w-3" /> akan handoff
          </span>
        )}
      </div>
      {result.fallback && (
        <p>
          Fallback:{" "}
          <span className="italic text-zinc-700">{result.fallback}</span>
        </p>
      )}
      {result.chunks.length > 0 && (
        <details className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5">
          <summary className="cursor-pointer text-xs font-medium text-zinc-700">
            Knowledge ({result.chunks.length})
          </summary>
          <ul className="mt-1.5 space-y-1.5">
            {result.chunks.map((c) => (
              <li key={c.chunk_id} className="rounded-md bg-zinc-50 p-1.5">
                <div className="font-mono text-[10px] text-muted-foreground">
                  score {c.score.toFixed(3)}
                </div>
                <p className="line-clamp-2 text-xs text-zinc-700">{c.content}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ConfidenceBar({
  value,
  threshold,
}: {
  value: number;
  threshold: number | null;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const below = threshold !== null && value < threshold;
  const tone = below
    ? "bg-amber-500"
    : value >= 0.7
      ? "bg-emerald-500"
      : "bg-zinc-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          confidence
        </span>
        <span
          className={cn(
            "font-mono text-[11px]",
            below ? "text-amber-700" : "text-zinc-700",
          )}
        >
          {pct}%
          {threshold !== null && (
            <span className="text-muted-foreground">
              {" "}
              / amb {Math.round(threshold * 100)}%
            </span>
          )}
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-200">
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${pct}%` }}
        />
        {threshold !== null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-zinc-900"
            style={{ left: `${Math.round(threshold * 100)}%` }}
            title={`Ambang handoff ${threshold.toFixed(2)}`}
          />
        )}
      </div>
    </div>
  );
}
