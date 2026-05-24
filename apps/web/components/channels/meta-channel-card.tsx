"use client";

import { CheckCircle2 } from "lucide-react";
import type { Channel, ChannelType } from "@aichat/shared";
import { formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CHANNEL_META } from "@/components/channels/channel-meta";

/** Compact "connected account" card shown after a successful Meta connect. */
export function ConnectedAccountCard({
  channel,
  externalLabel,
}: {
  channel: Channel;
  externalLabel: string;
}) {
  const meta = CHANNEL_META[channel.type as ChannelType];
  const Icon = meta.icon;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: meta.color }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {channel.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {externalLabel}: <code>{channel.external_id ?? "—"}</code>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Dibuat {formatRelativeTime(channel.created_at)}
          </p>
        </div>
        <Badge variant={channel.status === "connected" ? "success" : "warning"}>
          {channel.status}
        </Badge>
      </div>
    </Card>
  );
}

/** Side-by-side copy row used to surface the webhook URL + verify token. */
export function CopyRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const copy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(value).catch(() => {});
    }
  };
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-zinc-50 px-3 py-2">
        <code className="flex-1 truncate text-xs">{value}</code>
        <button
          onClick={copy}
          className="rounded-md px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Salin
        </button>
      </div>
    </div>
  );
}
