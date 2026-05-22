"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Infinity as InfinityIcon } from "lucide-react";
import type { UsageMetric } from "@aichat/shared";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function UsageSummary({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["usage", workspaceId],
    queryFn: () => api.billing.usage(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const metrics = data?.metrics ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Pemakaian saat ini</CardTitle>
            <CardDescription>
              Penggunaan vs batas paket{data?.plan_code ? ` (${data.plan_code})` : ""}.
            </CardDescription>
          </div>
          <Link
            href="/dashboard/billing/usage"
            className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900"
          >
            Detail <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : metrics.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada data usage.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {metrics.map((m) => (
              <MetricRow key={m.metric} metric={m} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricRow({ metric }: { metric: UsageMetric }) {
  const unlimited = metric.unlimited || metric.limit < 0;
  const unavailable = metric.limit === 0;
  const pct =
    unlimited || metric.limit <= 0
      ? 0
      : Math.min(100, Math.round((metric.used / metric.limit) * 100));
  const over = !unlimited && metric.limit > 0 && metric.used >= metric.limit;
  const near = !over && pct >= 80;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-700">{metric.label}</span>
        <span className="text-muted-foreground">
          {unlimited ? (
            <span className="inline-flex items-center gap-1">
              {metric.used} <InfinityIcon className="h-3 w-3" />
            </span>
          ) : unavailable ? (
            <Badge variant="secondary" className="text-[10px]">
              N/A
            </Badge>
          ) : (
            <span className={over ? "font-semibold text-red-600" : ""}>
              {metric.used}/{metric.limit}
            </span>
          )}
        </span>
      </div>
      {!unlimited && !unavailable && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className={cn(
              "h-full rounded-full",
              over ? "bg-red-500" : near ? "bg-amber-500" : "bg-emerald-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
