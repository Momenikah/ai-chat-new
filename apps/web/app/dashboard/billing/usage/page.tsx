"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Activity, ArrowLeft, Infinity as InfinityIcon } from "lucide-react";
import type { UsageMetric } from "@aichat/shared";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function UsagePage() {
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const { data, isLoading } = useQuery({
    queryKey: ["usage", workspaceId],
    queryFn: () => api.billing.usage(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const metrics = data?.metrics ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <div className="flex items-center gap-3">
        <Link href="/dashboard/billing">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Usage</h1>
          <p className="text-sm text-muted-foreground">
            Penggunaan saat ini versus batas paket{" "}
            {data?.plan_code ? `(${data.plan_code})` : ""}.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <div className="space-y-3">
          {metrics.map((m) => (
            <UsageRow key={m.metric} metric={m} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function UsageRow({ metric }: { metric: UsageMetric }) {
  const unlimited = metric.unlimited || metric.limit < 0;
  const unavailable = metric.limit === 0;
  const pct = unlimited || metric.limit <= 0
    ? 0
    : Math.min(100, Math.round((metric.used / metric.limit) * 100));
  const over = !unlimited && metric.limit > 0 && metric.used >= metric.limit;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{metric.label}</span>
          <span className="text-sm text-muted-foreground">
            {unlimited ? (
              <span className="inline-flex items-center gap-1">
                {metric.used} <InfinityIcon className="h-3.5 w-3.5" />
              </span>
            ) : unavailable ? (
              <Badge variant="secondary">Tidak tersedia</Badge>
            ) : (
              <span className={over ? "font-semibold text-red-600" : ""}>
                {metric.used} / {metric.limit}
              </span>
            )}
          </span>
        </div>
        {!unlimited && !unavailable && (
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className={`h-full rounded-full ${over ? "bg-red-500" : "bg-zinc-900"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
