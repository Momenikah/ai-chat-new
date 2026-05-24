"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { FlaskConical, Loader2, Search } from "lucide-react";
import type { KnowledgeSearchResult } from "@aichat/shared";
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

export function RagTester({ workspaceId }: { workspaceId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeSearchResult[] | null>(null);

  const run = useMutation({
    mutationFn: () => api.knowledge.search(workspaceId, query.trim(), 5),
    onSuccess: (r) => setResults(r.results),
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
            <CardTitle>Uji retrieval RAG</CardTitle>
            <CardDescription>
              Lihat chunk mana yang akan ditarik untuk sebuah pertanyaan +
              skor relevansinya.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) run.mutate();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="mis. Bagaimana kebijakan retur?"
              className="h-9 w-full rounded-lg border border-input bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:bg-white"
            />
          </div>
          <Button type="submit" disabled={run.isPending || !query.trim()}>
            {run.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Cari
          </Button>
        </form>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <AnimatePresence>
          {results && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {results.length === 0 ? (
                <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                  Tidak ada chunk relevan. Tambahkan dokumen atau ubah query.
                </p>
              ) : (
                <ul className="space-y-2">
                  {results.map((r, i) => (
                    <li
                      key={r.chunk_id}
                      className="rounded-lg border border-border bg-zinc-50/40 p-3"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-zinc-400">
                          #{i + 1}
                        </span>
                        <ScoreBar score={r.score} />
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                          pos {r.position}
                        </span>
                      </div>
                      <p className="line-clamp-4 text-xs text-zinc-700">
                        {r.content}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(score * 100)));
  const tone =
    score >= 0.7
      ? "bg-emerald-500"
      : score >= 0.4
        ? "bg-amber-500"
        : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {pct}%
      </span>
    </div>
  );
}
