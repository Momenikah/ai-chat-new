"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SeatUsage({ workspaceId }: { workspaceId: string }) {
  const { data } = useQuery({
    queryKey: ["usage", workspaceId],
    queryFn: () => api.billing.usage(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const seat = useMemo(() => {
    const metrics = data?.metrics ?? [];
    return (
      metrics.find(
        (m) =>
          m.metric === "team_members" ||
          m.metric === "team" ||
          /anggota|team|member|kursi/i.test(m.label),
      ) ?? null
    );
  }, [data]);

  if (!seat) return null;

  const unlimited = seat.unlimited || seat.limit < 0;
  const pct = unlimited
    ? 0
    : seat.limit > 0
      ? Math.min(100, Math.round((seat.used / seat.limit) * 100))
      : 100;
  const atLimit = !unlimited && seat.used >= seat.limit;
  const near = !unlimited && !atLimit && pct >= 80;

  return (
    <Card
      className={cn(
        "p-4",
        atLimit
          ? "border-red-200 bg-red-50/40"
          : near
            ? "border-amber-200 bg-amber-50/40"
            : "",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            atLimit
              ? "bg-red-500 text-white"
              : near
                ? "bg-amber-500 text-white"
                : "bg-zinc-900 text-white",
          )}
        >
          {atLimit || near ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Users className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Kursi tim</p>
            <span className="text-sm tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">{seat.used}</span>{" "}
              / {unlimited ? "∞" : seat.limit}
            </span>
          </div>
          {!unlimited && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  atLimit ? "bg-red-500" : near ? "bg-amber-500" : "bg-emerald-500",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {(atLimit || near) && (
            <p className="mt-1.5 flex items-center justify-between gap-2 text-xs text-amber-800">
              <span>
                {atLimit
                  ? "Kursi penuh — upgrade paket untuk menambah anggota."
                  : "Mendekati batas kursi paket Anda."}
              </span>
              <Link
                href="/dashboard/billing"
                className="inline-flex shrink-0 items-center gap-1 font-medium text-zinc-900 hover:underline"
              >
                Upgrade <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
