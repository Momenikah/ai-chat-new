"use client";

import { Search } from "lucide-react";
import type { ChannelType } from "@aichat/shared";
import { CHANNEL_META } from "@/components/channels/channel-meta";
import { cn } from "@/lib/utils";

export type InboxFilter =
  | "all"
  | "mine"
  | "unassigned"
  | "unread"
  | "resolved";

export const INBOX_FILTERS: { key: InboxFilter; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "mine", label: "Saya" },
  { key: "unassigned", label: "Belum di-assign" },
  { key: "unread", label: "Belum dibaca" },
  { key: "resolved", label: "Selesai" },
];

const CHANNEL_KEYS: ChannelType[] = ["whatsapp", "instagram", "messenger"];

export function InboxFilters({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  counts,
  channelFilter,
  onChannelFilterChange,
  channelCounts,
  searchRef,
}: {
  filter: InboxFilter;
  onFilterChange: (f: InboxFilter) => void;
  search: string;
  onSearchChange: (s: string) => void;
  counts: Record<InboxFilter, number>;
  channelFilter: ChannelType | null;
  onChannelFilterChange: (c: ChannelType | null) => void;
  channelCounts: Record<ChannelType, number>;
  searchRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="space-y-2.5 border-b border-border bg-white px-3 pb-3 pt-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cari nama atau pesan… (/)"
          className="h-8 w-full rounded-lg border border-input bg-zinc-50 pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:bg-white"
        />
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {INBOX_FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px]",
                  active ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-500",
                )}
              >
                {counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1 overflow-x-auto">
        <ChannelChip
          active={channelFilter === null}
          onClick={() => onChannelFilterChange(null)}
        >
          Semua channel
        </ChannelChip>
        {CHANNEL_KEYS.map((c) => {
          const meta = CHANNEL_META[c];
          const Icon = meta.icon;
          const active = channelFilter === c;
          return (
            <ChannelChip
              key={c}
              active={active}
              onClick={() => onChannelFilterChange(active ? null : c)}
            >
              <Icon
                className="h-3 w-3"
                style={{ color: active ? "#fff" : meta.color }}
              />
              <span className="capitalize">{c}</span>
              <span
                className={cn(
                  "rounded-full px-1 text-[10px]",
                  active ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-500",
                )}
              >
                {channelCounts[c]}
              </span>
            </ChannelChip>
          );
        })}
      </div>
    </div>
  );
}

function ChannelChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
      )}
    >
      {children}
    </button>
  );
}
