"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Instagram, MessageCircle, Send } from "lucide-react";
import type { DashboardOverview } from "@aichat/shared";
import { cn, formatRelativeTime, initials } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CHANNEL_ICON = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  messenger: Send,
} as const;

const STATUS_VARIANT = {
  open: "success",
  pending: "warning",
  resolved: "secondary",
  spam: "destructive",
} as const;

export function RecentConversations({
  data,
}: {
  data: DashboardOverview["recent_conversations"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Percakapan Terbaru</CardTitle>
        <CardDescription>Aktivitas inbox lintas channel terbaru</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {data.length === 0 && (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            Belum ada percakapan untuk workspace ini.
          </div>
        )}
        {data.map((c, i) => {
          const Icon =
            CHANNEL_ICON[c.channel_type as keyof typeof CHANNEL_ICON] ??
            MessageCircle;
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.25 }}
            >
              <Link
                href={`/dashboard/inbox?conversation=${c.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-zinc-50"
              >
                <div className="relative">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                    {initials(c.contact_name)}
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-1 ring-zinc-200">
                    <Icon className="h-2.5 w-2.5 text-zinc-600" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {c.contact_name}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(c.last_message_at)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.preview ?? c.channel_name}
                  </p>
                </div>
                {c.unread_count > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 px-1.5 text-[10px] font-semibold text-white">
                    {c.unread_count}
                  </span>
                )}
                <Badge
                  variant={STATUS_VARIANT[c.status]}
                  className={cn("shrink-0 capitalize")}
                >
                  {c.status}
                </Badge>
              </Link>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
