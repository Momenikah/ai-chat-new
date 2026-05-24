"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import type { APIUsageLog } from "@aichat/shared";
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

export function UsageLogsPanel({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["api-usage", workspaceId],
    queryFn: () => api.apiKeys.usage(workspaceId, 100),
    enabled: Boolean(workspaceId),
  });

  const logs = useMemo(() => data?.logs ?? [], [data]);

  const summary = useMemo(() => {
    if (logs.length === 0) return null;
    const ok = logs.filter((l) => l.status_code < 400).length;
    const avgLatency =
      logs.reduce((s, l) => s + l.latency_ms, 0) / logs.length;
    return {
      successRate: (ok / logs.length) * 100,
      avgLatency: Math.round(avgLatency),
    };
  }, [logs]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Aktivitas Public API</CardTitle>
            <CardDescription>
              100 request terakhir yang memakai API key workspace ini.
            </CardDescription>
          </div>
          {summary && (
            <div className="flex shrink-0 gap-3 text-right text-xs">
              <div>
                <p className="font-semibold tabular-nums">
                  {summary.successRate.toFixed(0)}%
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  sukses
                </p>
              </div>
              <div>
                <p className="font-semibold tabular-nums">
                  {summary.avgLatency}ms
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  avg latency
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
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center">
            <Activity className="mx-auto h-6 w-6 text-zinc-400" />
            <p className="mt-2 text-sm font-medium">Belum ada request</p>
            <p className="text-xs text-muted-foreground">
              Log muncul setelah API key dipakai memanggil Public API.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {logs.slice(0, 100).map((l) => (
              <LogRow key={l.id} log={l} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LogRow({ log }: { log: APIUsageLog }) {
  return (
    <li className="flex items-center gap-2 py-2 text-xs">
      <span
        className={cn(
          "w-12 shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-[10px] font-medium",
          methodTone(log.method),
        )}
      >
        {log.method}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-zinc-700">
        {log.path}
      </span>
      <span
        className={cn(
          "shrink-0 font-mono tabular-nums",
          log.status_code >= 400 ? "text-red-600" : "text-emerald-600",
        )}
      >
        {log.status_code}
      </span>
      <span className="hidden w-14 shrink-0 text-right tabular-nums text-muted-foreground sm:inline">
        {log.latency_ms}ms
      </span>
      <span className="hidden w-24 shrink-0 truncate text-right text-muted-foreground md:inline">
        {log.ip ?? "—"}
      </span>
      <span className="w-16 shrink-0 text-right text-[10px] text-muted-foreground">
        {formatRelativeTime(log.created_at)}
      </span>
    </li>
  );
}

function methodTone(method: string) {
  switch (method.toUpperCase()) {
    case "GET":
      return "bg-sky-100 text-sky-700";
    case "POST":
      return "bg-emerald-100 text-emerald-700";
    case "PATCH":
    case "PUT":
      return "bg-amber-100 text-amber-700";
    case "DELETE":
      return "bg-red-100 text-red-700";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}
