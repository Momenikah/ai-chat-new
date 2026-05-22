"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { AlertTriangle, KeyRound, Loader2, RefreshCw, Trash2 } from "lucide-react";
import type { Channel, ChannelStatus } from "@aichat/shared";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { CHANNEL_META, STATUS_META } from "./channel-meta";
import { ReconnectDialog } from "./reconnect-dialog";

const STATUSES: ChannelStatus[] = [
  "disconnected",
  "pending",
  "connected",
  "error",
];

export function ChannelCard({
  channel,
  index,
  canManage,
  onChanged,
}: {
  channel: Channel;
  index: number;
  canManage: boolean;
  onChanged: () => void;
}) {
  const meta = CHANNEL_META[channel.type];
  const status = STATUS_META[channel.status];
  const Icon = meta.icon;
  const [reconnectOpen, setReconnectOpen] = useState(false);

  const statusMutation = useMutation({
    mutationFn: (next: ChannelStatus) =>
      api.channels.update(channel.id, { status: next }),
    onSuccess: onChanged,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.channels.remove(channel.id),
    onSuccess: onChanged,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      whileHover={{ y: -2 }}
    >
      <Card className="p-5 transition-shadow hover:shadow-md">
        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: meta.color }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{channel.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {meta.label}
            </p>
          </div>
          <Badge variant={status.variant}>
            <span
              className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status.dot}`}
            />
            {status.label}
          </Badge>
        </div>

        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <KeyRound className="h-3.5 w-3.5" />
            {channel.has_credentials
              ? "Credential tersimpan (terenkripsi)"
              : "Belum ada credential"}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {channel.last_connected_at
            ? `Terhubung ${formatRelativeTime(channel.last_connected_at)}`
            : `Dibuat ${formatRelativeTime(channel.created_at)}`}
        </p>

        {channel.status === "error" && channel.error_message && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 break-words">{channel.error_message}</span>
          </div>
        )}

        {canManage && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Select
                value={channel.status}
                disabled={statusMutation.isPending}
                onChange={(e) =>
                  statusMutation.mutate(e.target.value as ChannelStatus)
                }
                className="h-8 flex-1 text-xs"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </Select>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-600"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (confirm(`Hapus channel "${channel.name}"?`)) {
                    deleteMutation.mutate();
                  }
                }}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setReconnectOpen(true)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {channel.has_credentials ? "Reconnect / rotasi credential" : "Hubungkan credential"}
            </Button>
          </div>
        )}
      </Card>

      <ReconnectDialog
        channel={channel}
        open={reconnectOpen}
        onOpenChange={setReconnectOpen}
        onDone={onChanged}
      />
    </motion.div>
  );
}
