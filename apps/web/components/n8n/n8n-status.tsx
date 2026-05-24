"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Check, Circle, ExternalLink } from "lucide-react";
import type { WebhookEndpoint } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatRelativeTime } from "@/lib/utils";

export function N8nStatus({
  endpoints,
  loading,
}: {
  endpoints: WebhookEndpoint[];
  loading: boolean;
}) {
  const steps = useMemo(() => {
    const hasEndpoint = endpoints.length > 0;
    const hasEnabled = endpoints.some((e) => e.enabled);
    const hasDelivery = endpoints.some((e) => e.last_delivery_at);
    return [
      { label: "Daftarkan endpoint webhook n8n", done: hasEndpoint },
      { label: "Endpoint dalam keadaan aktif", done: hasEnabled },
      { label: "Sudah ada delivery yang terkirim", done: hasDelivery },
    ];
  }, [endpoints]);

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Status koneksi</h2>
        <span className="text-xs text-muted-foreground">
          {doneCount}/{steps.length} langkah
        </span>
      </div>

      <ol className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                s.done
                  ? "bg-emerald-500 text-white"
                  : "border border-zinc-300 text-zinc-300",
              )}
            >
              {s.done ? (
                <Check className="h-3 w-3" />
              ) : (
                <Circle className="h-2 w-2 fill-current" />
              )}
            </span>
            <span className={cn(s.done ? "text-zinc-700" : "text-muted-foreground")}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      <div className="border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Endpoint terhubung
          </p>
          <Link
            href="/dashboard/developer/webhooks"
            className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900"
          >
            Kelola <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : endpoints.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            Belum ada endpoint. Gunakan form Quick-connect di bawah.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {endpoints.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    {e.enabled ? (
                      <Badge variant="success">aktif</Badge>
                    ) : (
                      <Badge variant="secondary">nonaktif</Badge>
                    )}
                    {e.failure_count > 0 && (
                      <Badge variant="warning">{e.failure_count} gagal</Badge>
                    )}
                  </div>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {e.url}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {e.last_delivery_at
                    ? formatRelativeTime(e.last_delivery_at)
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
