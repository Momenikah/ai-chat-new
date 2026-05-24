"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Merge,
  UserPlus,
  Upload,
  PencilLine,
  Activity as ActivityIcon,
  type LucideIcon,
} from "lucide-react";
import type { ContactActivity, ContactMessage } from "@aichat/shared";
import { cn } from "@/lib/utils";
import { CHANNEL_META } from "@/components/channels/channel-meta";

type Entry =
  | { kind: "activity"; date: string; activity: ContactActivity }
  | { kind: "message"; date: string; message: ContactMessage };

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  contact_created: UserPlus,
  contact_imported: Upload,
  contact_merged: Merge,
  contact_updated: PencilLine,
};

export function ContactTimeline({
  activities,
  messages,
}: {
  activities: ContactActivity[];
  messages: ContactMessage[];
}) {
  const entries: Entry[] = useMemo(() => {
    const merged: Entry[] = [
      ...activities.map((a) => ({
        kind: "activity" as const,
        date: a.occurred_at,
        activity: a,
      })),
      ...messages.map((m) => ({
        kind: "message" as const,
        date: m.created_at,
        message: m,
      })),
    ];
    return merged.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [activities, messages]);

  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
        Belum ada aktivitas.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((e, i) => (
        <motion.li
          key={(e.kind === "activity" ? e.activity.id : e.message.id) + i}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(0.03 * i, 0.2) }}
          className="flex gap-3"
        >
          {e.kind === "activity" ? (
            <ActivityEntry activity={e.activity} />
          ) : (
            <MessageEntry message={e.message} />
          )}
        </motion.li>
      ))}
    </ol>
  );
}

function ActivityEntry({ activity }: { activity: ContactActivity }) {
  const Icon = ACTIVITY_ICONS[activity.kind] ?? ActivityIcon;
  return (
    <>
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100">
        <Icon className="h-3.5 w-3.5 text-zinc-700" />
      </span>
      <div className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium capitalize text-zinc-700">
            {activity.kind.replace(/_/g, " ")}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {formatDateTime(activity.occurred_at)}
          </span>
        </div>
        {activity.body && (
          <p className="mt-0.5 text-sm">{activity.body}</p>
        )}
        {activity.actor_name && (
          <p className="text-[10px] text-muted-foreground">
            oleh {activity.actor_name}
          </p>
        )}
      </div>
    </>
  );
}

function MessageEntry({ message }: { message: ContactMessage }) {
  const outbound = message.direction === "outbound";
  const meta = CHANNEL_META[message.channel_type];
  return (
    <>
      <span
        className={cn(
          "mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          outbound ? "bg-zinc-900 text-white" : "bg-zinc-100",
        )}
      >
        {outbound ? (
          <ArrowUpRight className="h-3.5 w-3.5" />
        ) : (
          <ArrowDownLeft className="h-3.5 w-3.5 text-zinc-700" />
        )}
      </span>
      <div className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className="text-[11px] font-medium"
            style={{ color: meta.color }}
          >
            {outbound ? "Outbound" : "Inbound"} · {meta.label}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {formatDateTime(message.created_at)}
          </span>
        </div>
        <p className="mt-0.5 text-sm">
          {message.body ?? (
            <em className="text-muted-foreground">(tanpa teks)</em>
          )}
        </p>
      </div>
    </>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
