"use client";

import { Search, X } from "lucide-react";
import type { ChannelType, Tag } from "@aichat/shared";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";

export type ContactQuickFilter =
  | null
  | "new_today"
  | "with_company"
  | "no_email"
  | "no_phone";

export interface ContactFilterState {
  search: string;
  channel: ChannelType | "";
  tagId: string;
  quick: ContactQuickFilter;
}

const QUICK_FILTERS: { key: NonNullable<ContactQuickFilter>; label: string }[] = [
  { key: "new_today", label: "Baru hari ini" },
  { key: "with_company", label: "Ada perusahaan" },
  { key: "no_email", label: "Tanpa email" },
  { key: "no_phone", label: "Tanpa telepon" },
];

export function ContactFilters({
  state,
  onChange,
  tags,
}: {
  state: ContactFilterState;
  onChange: (next: ContactFilterState) => void;
  tags: Tag[];
}) {
  const anyActive =
    state.search || state.channel || state.tagId || state.quick;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={state.search}
            onChange={(e) => onChange({ ...state, search: e.target.value })}
            placeholder="Cari nama, telepon, atau email…"
            className={cn(
              "h-9 w-full rounded-lg border border-input bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:bg-white",
            )}
          />
        </div>

        <Select
          value={state.channel}
          onChange={(e) =>
            onChange({ ...state, channel: e.target.value as ChannelType | "" })
          }
          className="h-9 w-44 text-sm"
        >
          <option value="">Semua channel</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="messenger">Messenger</option>
        </Select>

        <Select
          value={state.tagId}
          onChange={(e) => onChange({ ...state, tagId: e.target.value })}
          className="h-9 w-44 text-sm"
        >
          <option value="">Semua tag</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>

        {anyActive && (
          <button
            type="button"
            onClick={() =>
              onChange({ search: "", channel: "", tagId: "", quick: null })
            }
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
          >
            <X className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_FILTERS.map((q) => {
          const active = state.quick === q.key;
          return (
            <button
              key={q.key}
              type="button"
              onClick={() =>
                onChange({ ...state, quick: active ? null : q.key })
              }
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                active
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
              )}
            >
              {q.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
