"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRightLeft,
  CheckCircle2,
  Inbox,
  Radio,
  Send,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import type {
  Conversation,
  InboxEvent,
  InternalNote,
  Message,
} from "@aichat/shared";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useInboxSocket } from "@/hooks/use-inbox-socket";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MAX_EVENTS = 8;

interface ActivityRow {
  id: string;
  icon: LucideIcon;
  iconClass: string;
  title: string;
  body: string;
  conversationId: string | null;
  at: number;
}

export function LiveActivity() {
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const [rows, setRows] = useState<ActivityRow[]>([]);

  const handleEvent = useCallback((event: InboxEvent) => {
    const row = mapEventToRow(event);
    if (!row) return;
    setRows((prev) => [row, ...prev].slice(0, MAX_EVENTS));
  }, []);

  const { status } = useInboxSocket(workspaceId, handleEvent);

  // Reset feed when workspace changes.
  useEffect(() => {
    setRows([]);
  }, [workspaceId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4" /> Aktivitas live
          </CardTitle>
          <CardDescription>Event realtime dari semua channel.</CardDescription>
        </div>
        <StatusDot status={status} />
      </CardHeader>
      <div className="px-3 pb-3">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
            {status === "open"
              ? "Menunggu event baru…"
              : "Menghubungkan ke inbox hub…"}
          </p>
        ) : (
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {rows.map((row) => (
                <ActivityItem key={row.id} row={row} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </Card>
  );
}

function ActivityItem({ row }: { row: ActivityRow }) {
  const Icon = row.icon;
  const body = (
    <div className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-zinc-50">
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          row.iconClass,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{row.title}</p>
        <p className="truncate text-xs text-muted-foreground">{row.body}</p>
      </div>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {formatTimeShort(row.at)}
      </span>
    </div>
  );
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {row.conversationId ? (
        <Link href={`/dashboard/inbox?conversation=${row.conversationId}`}>
          {body}
        </Link>
      ) : (
        body
      )}
    </motion.li>
  );
}

function StatusDot({ status }: { status: "connecting" | "open" | "closed" }) {
  const map: Record<typeof status, { label: string; color: string }> = {
    open: { label: "live", color: "bg-emerald-500" },
    connecting: { label: "menghubungkan", color: "bg-amber-500" },
    closed: { label: "offline", color: "bg-zinc-300" },
  };
  const cfg = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.color)} />
      {cfg.label}
    </span>
  );
}

function mapEventToRow(event: InboxEvent): ActivityRow | null {
  const now = Date.now();
  switch (event.type) {
    case "message.new": {
      const msg = event.payload as Message;
      const inbound = msg.direction === "inbound";
      return {
        id: `${event.type}:${msg.id}`,
        icon: inbound ? Inbox : Send,
        iconClass: inbound
          ? "bg-blue-100 text-blue-700"
          : "bg-zinc-100 text-zinc-700",
        title: inbound ? "Pesan masuk" : "Pesan terkirim",
        body: msg.body?.trim() || `(${msg.kind})`,
        conversationId: msg.conversation_id,
        at: now,
      };
    }
    case "conversation.updated": {
      const conv = event.payload as Conversation;
      if (conv.status === "resolved") {
        return {
          id: `resolved:${conv.id}:${conv.updated_at}`,
          icon: CheckCircle2,
          iconClass: "bg-emerald-100 text-emerald-700",
          title: "Conversation resolved",
          body: conv.last_message_preview ?? "Status diperbarui",
          conversationId: conv.id,
          at: now,
        };
      }
      return null;
    }
    case "conversation.assigned": {
      const conv = event.payload as Conversation;
      return {
        id: `assigned:${conv.id}:${conv.updated_at}`,
        icon: ArrowRightLeft,
        iconClass: "bg-violet-100 text-violet-700",
        title: conv.assigned_agent_id
          ? "Percakapan di-assign"
          : "Assignment dilepas",
        body: conv.last_message_preview ?? "—",
        conversationId: conv.id,
        at: now,
      };
    }
    case "note.new": {
      const note = event.payload as InternalNote;
      return {
        id: `note:${note.id}`,
        icon: StickyNote,
        iconClass: "bg-amber-100 text-amber-700",
        title: `Catatan internal oleh ${note.author_name ?? "agent"}`,
        body: note.body?.trim() || "—",
        conversationId: note.conversation_id,
        at: now,
      };
    }
    default:
      return null;
  }
}

function formatTimeShort(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "baru saja";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}j`;
}
