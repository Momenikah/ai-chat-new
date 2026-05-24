"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Bot, MessageSquare } from "lucide-react";
import type { BotReplyLog } from "@aichat/shared";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatRelativeTime } from "@/lib/utils";

export function BotLogsPanel({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-logs", workspaceId],
    queryFn: () => api.ai.logs(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const logs = useMemo(() => data?.logs ?? [], [data]);

  const summary = useMemo(() => {
    if (logs.length === 0) return null;
    const handed = logs.filter((l) => l.handed_off).length;
    const avgConf =
      logs.reduce((s, l) => s + l.confidence, 0) / logs.length;
    return {
      total: logs.length,
      handoffRate: (handed / logs.length) * 100,
      avgConf: avgConf * 100,
    };
  }, [logs]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Riwayat balasan bot</CardTitle>
            <CardDescription>
              100 balasan otomatis terakhir + status handoff.
            </CardDescription>
          </div>
          {summary && (
            <div className="flex shrink-0 gap-3 text-right text-xs">
              <div>
                <p className="font-semibold tabular-nums">
                  {summary.avgConf.toFixed(0)}%
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  avg conf
                </p>
              </div>
              <div>
                <p className="font-semibold tabular-nums">
                  {summary.handoffRate.toFixed(0)}%
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  handoff
                </p>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center">
            <Bot className="mx-auto h-6 w-6 text-zinc-400" />
            <p className="mt-2 text-sm font-medium">Belum ada balasan bot</p>
            <p className="text-xs text-muted-foreground">
              Log muncul setelah bot membalas pesan masuk pertama.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {logs.slice(0, 100).map((l) => (
              <LogRow key={l.id} log={l} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LogRow({ log }: { log: BotReplyLog }) {
  const pct = Math.round(log.confidence * 100);
  const confTone =
    log.confidence >= 0.7
      ? "bg-emerald-100 text-emerald-700"
      : log.confidence >= 0.4
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";

  return (
    <li className="rounded-lg border border-border bg-zinc-50/40 p-3">
      <div className="flex items-start gap-2">
        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          <span className="font-medium text-zinc-700">Masuk:</span>{" "}
          {log.inbound_text ?? "—"}
        </p>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatRelativeTime(log.created_at)}
        </span>
      </div>
      <div className="mt-1.5 flex items-start gap-2">
        <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-700" />
        <p className="min-w-0 flex-1 text-sm">
          {log.error_message ? (
            <span className="text-red-600">Error: {log.error_message}</span>
          ) : (
            (log.response_text ?? "—")
          )}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "rounded px-1.5 py-px text-[10px] font-medium",
            confTone,
          )}
        >
          {pct}%
        </span>
        {log.handed_off && (
          <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-700">
            <ArrowRightLeft className="h-2.5 w-2.5" /> handoff
          </span>
        )}
        {log.chunk_ids.length > 0 && (
          <span className="rounded bg-zinc-100 px-1.5 py-px text-[10px] text-zinc-500">
            {log.chunk_ids.length} chunk
          </span>
        )}
        {log.model && (
          <span className="rounded bg-zinc-100 px-1.5 py-px text-[10px] text-zinc-500">
            {log.model}
          </span>
        )}
      </div>
    </li>
  );
}
