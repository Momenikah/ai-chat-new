"use client";

import { motion } from "motion/react";
import { Clock } from "lucide-react";
import type { ConversationListItem } from "@aichat/shared";
import { cn, formatRelativeTime, initials } from "@/lib/utils";
import { CHANNEL_META } from "@/components/channels/channel-meta";

export function ConversationList({
  items,
  selectedId,
  onSelect,
  bulkMode,
  selectedIds,
  onToggleSelect,
}: {
  items: ConversationListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  bulkMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <p className="text-sm font-medium">Tidak ada percakapan</p>
        <p className="text-xs text-muted-foreground">
          Coba ubah filter atau tunggu pesan masuk.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto">
      {items.map((c, i) => {
        const meta = CHANNEL_META[c.channel_type];
        const ChannelIcon = meta.icon;
        const active = c.id === selectedId;
        const preview = c.last_message_preview ?? "—";
        const checked = bulkMode && selectedIds?.has(c.id);
        const sla = computeSla(c);

        return (
          <motion.li
            key={c.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: Math.min(0.02 * i, 0.2) }}
          >
            <button
              onClick={() => {
                if (bulkMode && onToggleSelect) onToggleSelect(c.id);
                else onSelect(c.id);
              }}
              className={cn(
                "flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors",
                active && !bulkMode
                  ? "bg-zinc-50"
                  : checked
                    ? "bg-blue-50/60"
                    : "hover:bg-zinc-50/60",
              )}
            >
              {bulkMode && (
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    checked
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white",
                  )}
                >
                  {checked && (
                    <svg
                      viewBox="0 0 12 12"
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path d="M2.5 6.5L5 9l4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              )}

              <div className="relative shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                  {initials(c.contact_name)}
                </div>
                <span
                  className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-1 ring-zinc-200"
                  style={{ color: meta.color }}
                >
                  <ChannelIcon className="h-2.5 w-2.5" />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium">
                    {c.contact_name}
                  </p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatRelativeTime(c.last_message_at)}
                  </span>
                </div>
                <p
                  className={cn(
                    "truncate text-xs",
                    c.unread_count > 0
                      ? "font-medium text-zinc-900"
                      : "text-muted-foreground",
                  )}
                >
                  {preview}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded px-1.5 py-px text-[10px] uppercase tracking-wider",
                      statusChip(c.status),
                    )}
                  >
                    {c.status}
                  </span>
                  {c.assigned_agent_id ? (
                    <span className="text-[10px] text-muted-foreground">
                      • assigned
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-700">
                      • unassigned
                    </span>
                  )}
                  {sla && (
                    <span
                      className={cn(
                        "ml-auto inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-medium",
                        sla.tone,
                      )}
                      title={`Belum dibalas ${sla.label}`}
                    >
                      <Clock className="h-2.5 w-2.5" />
                      {sla.label}
                    </span>
                  )}
                  {c.unread_count > 0 && (
                    <span
                      className={cn(
                        "inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-900 px-1 text-[10px] font-semibold text-white",
                        !sla && "ml-auto",
                      )}
                    >
                      {c.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}

function statusChip(s: string) {
  switch (s) {
    case "open":
      return "bg-emerald-50 text-emerald-700";
    case "pending":
      return "bg-amber-50 text-amber-700";
    case "resolved":
      return "bg-zinc-100 text-zinc-600";
    case "spam":
      return "bg-red-50 text-red-700";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

/**
 * Best-effort wait-time indicator. We don't have last_inbound_at separately,
 * so we treat unread inbound messages (unread_count > 0) on a non-resolved
 * conversation as "menunggu balasan" sejak `last_message_at`.
 */
function computeSla(c: ConversationListItem): {
  label: string;
  tone: string;
} | null {
  if (c.status === "resolved" || c.status === "spam") return null;
  if (c.unread_count === 0 && c.status !== "pending") return null;
  if (!c.last_message_at) return null;

  const diffMs = Date.now() - new Date(c.last_message_at).getTime();
  if (diffMs < 0) return null;

  const minutes = Math.floor(diffMs / 60_000);
  let label: string;
  if (minutes < 1) label = "<1m";
  else if (minutes < 60) label = `${minutes}m`;
  else if (minutes < 24 * 60) label = `${Math.floor(minutes / 60)}j`;
  else label = `${Math.floor(minutes / (24 * 60))}h`;

  let tone: string;
  if (minutes < 15) tone = "bg-emerald-50 text-emerald-700";
  else if (minutes < 60) tone = "bg-amber-50 text-amber-700";
  else tone = "bg-red-50 text-red-700";

  return { label, tone };
}
