"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  FileX,
  Loader2,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";
import type {
  BroadcastRecipient,
  BroadcastStatus,
  RecipientStatus,
} from "@aichat/shared";
import { api } from "@/lib/api";
import { formatRelativeTime, initials } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_META: Record<
  BroadcastStatus,
  {
    variant: "success" | "warning" | "secondary" | "destructive";
    icon: typeof CheckCircle2;
  }
> = {
  draft: { variant: "secondary", icon: FileX },
  scheduled: { variant: "warning", icon: Clock },
  sending: { variant: "warning", icon: Loader2 },
  completed: { variant: "success", icon: CheckCircle2 },
  failed: { variant: "destructive", icon: XCircle },
  cancelled: { variant: "secondary", icon: XCircle },
};

const RECIPIENT_BADGE: Record<RecipientStatus, "success" | "warning" | "secondary" | "destructive" | "outline"> = {
  queued: "warning",
  sent: "secondary",
  delivered: "secondary",
  read: "success",
  failed: "destructive",
  skipped: "outline",
};

export default function BroadcastDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { campaignId } = useParams<{ campaignId: string }>();
  const workspaceId = useWorkspaceStore((s) => s.currentId);

  const { data, isLoading } = useQuery({
    queryKey: ["broadcast", workspaceId, campaignId],
    queryFn: () => api.broadcasts.get(workspaceId as string, campaignId),
    enabled: Boolean(workspaceId && campaignId),
    refetchInterval: 4000,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.broadcasts.cancel(workspaceId as string, campaignId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["broadcast", workspaceId, campaignId],
      }),
  });

  const retryFailedMutation = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("Campaign belum dimuat");
      const failed = data.recipients.filter((r) => r.status === "failed");
      if (failed.length === 0) {
        throw new Error("Tidak ada recipient yang gagal.");
      }
      const csvRows = failed.map((r) => ({
        name: r.name ?? undefined,
        phone: r.phone ?? undefined,
        external_id: r.external_id ?? undefined,
        variables: r.variables ?? {},
      }));
      const created = await api.broadcasts.create(workspaceId as string, {
        name: `${data.campaign.name} (retry failed)`,
        channel_id: data.campaign.channel_id,
        template_id: data.campaign.template_id ?? undefined,
        audience_kind: "csv",
        audience_filter: { csv_rows: csvRows },
        body_override: data.campaign.body_override ?? undefined,
        rate_per_minute: data.campaign.rate_per_minute,
      });
      await api.broadcasts.schedule(workspaceId as string, created.id, {
        scheduled_at: new Date().toISOString(),
        launch: true,
      });
      return created;
    },
    onSuccess: (c) => router.push(`/dashboard/broadcasts/${c.id}`),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const { campaign, recipients, logs } = data;
  const meta = STATUS_META[campaign.status];
  const Icon = meta.icon;
  const spinning = campaign.status === "sending";
  const total = campaign.total_recipients || 0;
  const progress = total > 0
    ? Math.round(
        ((campaign.sent_count + campaign.failed_count) / total) * 100,
      )
    : 0;

  const replyRate = campaign.sent_count > 0
    ? ((campaign.reply_count / campaign.sent_count) * 100).toFixed(1)
    : "0.0";

  const canCancel =
    campaign.status === "scheduled" ||
    campaign.status === "draft" ||
    campaign.status === "sending";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-5xl space-y-6"
    >
      <div>
        <Link
          href="/dashboard/broadcasts"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke broadcast
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Send className="h-5 w-5 text-zinc-700" />
          <h1 className="text-xl font-semibold tracking-tight">{campaign.name}</h1>
          <Badge variant={meta.variant} className="gap-1">
            <Icon className={`h-3 w-3 ${spinning ? "animate-spin" : ""}`} />
            {campaign.status}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {campaign.audience_kind} · {campaign.rate_per_minute}/min ·
          dibuat {formatRelativeTime(campaign.created_at)}
        </p>
      </div>

      {/* Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <Stat label="Total" value={total} />
            <Stat label="Sent" value={campaign.sent_count} accent="emerald" />
            <Stat label="Delivered" value={campaign.delivered_count} accent="sky" />
            <Stat label="Read" value={campaign.read_count} accent="violet" />
            <Stat label="Failed" value={campaign.failed_count} accent="red" />
            <Stat label="Reply rate" value={`${replyRate}%`} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              Progress {progress}%
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
                className="h-full bg-zinc-900"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/broadcasts/new?from=${campaign.id}`}>
                <Copy className="h-4 w-4" /> Duplicate
              </Link>
            </Button>
            {campaign.failed_count > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  if (
                    confirm(
                      `Buat campaign baru yang mengirim ulang ke ${campaign.failed_count} recipient yang gagal?`,
                    )
                  ) {
                    retryFailedMutation.mutate();
                  }
                }}
                disabled={retryFailedMutation.isPending}
              >
                {retryFailedMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Resend ke failed ({campaign.failed_count})
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                className="text-red-600"
                onClick={() => {
                  if (confirm("Cancel campaign ini?"))
                    cancelMutation.mutate();
                }}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Cancel campaign
              </Button>
            )}
          </div>
          {retryFailedMutation.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {retryFailedMutation.error instanceof Error
                ? retryFailedMutation.error.message
                : "Gagal membuat retry campaign"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recipients */}
      <Card>
        <CardHeader>
          <CardTitle>
            Recipients{" "}
            <span className="text-muted-foreground">({recipients.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada recipient.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recipients.slice(0, 100).map((r) => (
                <RecipientRow key={r.id} r={r} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle>
            Activity log{" "}
            <span className="text-muted-foreground">({logs.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-xs">
            {logs.map((l) => (
              <li
                key={l.id}
                className="flex items-start gap-2 rounded-md bg-zinc-50/60 px-3 py-1.5"
              >
                <span className="font-mono uppercase tracking-wider text-zinc-500">
                  {l.event}
                </span>
                {l.detail && (
                  <span className="text-muted-foreground">— {l.detail}</span>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {formatRelativeTime(l.occurred_at)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RecipientRow({ r }: { r: BroadcastRecipient }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">
        {initials(r.name ?? r.phone ?? "?")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {r.name ?? r.phone ?? r.external_id ?? "(unknown)"}
        </p>
        {r.rendered_body && (
          <p className="truncate text-xs text-muted-foreground">
            {r.rendered_body}
          </p>
        )}
      </div>
      {r.attempts > 0 && (
        <span className="text-[10px] text-muted-foreground">
          {r.attempts}× attempts
        </span>
      )}
      <Badge variant={RECIPIENT_BADGE[r.status]}>{r.status}</Badge>
    </li>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "emerald" | "sky" | "violet" | "red";
}) {
  const color = {
    emerald: "text-emerald-600",
    sky: "text-sky-600",
    violet: "text-violet-600",
    red: "text-red-600",
  }[accent ?? "emerald"];
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
      <p className={`text-xl font-semibold tabular-nums ${accent ? color : ""}`}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
