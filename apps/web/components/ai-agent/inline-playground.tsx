"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightLeft, FlaskConical, Loader2, SendHorizontal } from "lucide-react";
import type { PlaygroundResult } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function InlinePlayground({
  workspaceId,
  systemPrompt,
}: {
  workspaceId: string;
  /** Current (possibly unsaved) prompt from the editor to test against. */
  systemPrompt: string;
}) {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<PlaygroundResult | null>(null);

  const run = useMutation({
    mutationFn: () =>
      api.ai.playground(workspaceId, {
        message: message.trim(),
        system_prompt: systemPrompt || undefined,
      }),
    onSuccess: (r) => setResult(r),
  });

  const error = run.error instanceof ApiException ? run.error.message : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <FlaskConical className="h-4 w-4" />
          </span>
          <div>
            <CardTitle>Uji cepat</CardTitle>
            <CardDescription>
              Tes prompt + knowledge base tanpa mengirim apapun ke pelanggan.
              Memakai prompt yang sedang diedit di atas.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (message.trim()) run.mutate();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ketik pertanyaan pelanggan untuk diuji…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (message.trim()) run.mutate();
              }
            }}
            className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          />
          <Button type="submit" disabled={run.isPending || !message.trim()}>
            {run.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
            Uji
          </Button>
        </form>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3 rounded-xl border border-border bg-zinc-50/60 p-3"
            >
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <p className="whitespace-pre-wrap text-sm">
                  {result.response || (
                    <span className="text-muted-foreground">(kosong)</span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <ConfidenceChip value={result.confidence} />
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-600">
                  model: {result.model}
                </span>
                {result.would_handoff && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                    <ArrowRightLeft className="h-3 w-3" /> akan handoff
                  </span>
                )}
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-600">
                  {result.chunks.length} chunk knowledge
                </span>
              </div>

              {result.would_handoff && result.fallback && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Fallback ke pelanggan: “{result.fallback}”
                </p>
              )}

              {result.chunks.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Knowledge dipakai
                  </p>
                  <ul className="space-y-1">
                    {result.chunks.slice(0, 3).map((c) => (
                      <li
                        key={c.chunk_id}
                        className="rounded-md bg-white px-2 py-1 text-xs text-muted-foreground"
                      >
                        <span className="mr-1 font-mono text-[10px] text-zinc-400">
                          {(c.score * 100).toFixed(0)}%
                        </span>
                        <span className="line-clamp-2">{c.content}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function ConfidenceChip({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.7
      ? "bg-emerald-100 text-emerald-700"
      : value >= 0.4
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium",
        tone,
      )}
    >
      confidence {pct}%
    </span>
  );
}
