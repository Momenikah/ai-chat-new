"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  Mail,
  Phone,
} from "lucide-react";
import type { Contact, Tag } from "@aichat/shared";
import { cn, formatRelativeTime, initials } from "@/lib/utils";
import { CHANNEL_META } from "@/components/channels/channel-meta";

export type ContactSortKey = "name" | "created_at" | "last_seen_at";
export type SortDir = "asc" | "desc";

const COLUMNS: { key: ContactSortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "Nama" },
  // Kontak (phone/email) — not sortable
  { key: "created_at", label: "Dibuat", align: "right" },
];

export function ContactTable({
  contacts,
  tagsByContact,
  bulkMode,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onQuickView,
  sortKey,
  sortDir,
  onSortChange,
}: {
  contacts: Contact[];
  tagsByContact?: Record<string, Tag[]>;
  bulkMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
  onQuickView?: (contact: Contact) => void;
  sortKey?: ContactSortKey;
  sortDir?: SortDir;
  onSortChange?: (key: ContactSortKey) => void;
}) {
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-white px-6 py-16 text-center">
        <p className="text-sm font-medium">Belum ada kontak</p>
        <p className="text-xs text-muted-foreground">
          Tambahkan kontak baru atau import dari CSV.
        </p>
      </div>
    );
  }

  const allChecked =
    bulkMode &&
    selectedIds &&
    contacts.length > 0 &&
    contacts.every((c) => selectedIds.has(c.id));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-zinc-50/60 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          <tr>
            {bulkMode && (
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={!!allChecked}
                  onChange={(e) => onToggleAll?.(e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer rounded border-zinc-300"
                />
              </th>
            )}
            <SortableTh
              column={COLUMNS[0]}
              sortKey={sortKey}
              sortDir={sortDir}
              onChange={onSortChange}
            />
            <th className="px-4 py-2.5">Kontak</th>
            <th className="px-4 py-2.5">Channel</th>
            <th className="px-4 py-2.5">Tags</th>
            <SortableTh
              column={COLUMNS[1]}
              sortKey={sortKey}
              sortDir={sortDir}
              onChange={onSortChange}
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {contacts.map((c, i) => {
            const meta = c.external_source
              ? CHANNEL_META[c.external_source]
              : null;
            const Icon = meta?.icon;
            const tags = tagsByContact?.[c.id] ?? [];
            const checked = bulkMode && selectedIds?.has(c.id);

            return (
              <motion.tr
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(0.02 * i, 0.2) }}
                className={cn(
                  "transition-colors",
                  checked ? "bg-blue-50/60" : "hover:bg-zinc-50/60",
                )}
              >
                {bulkMode && (
                  <td className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={!!checked}
                      onChange={() => onToggleSelect?.(c.id)}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-zinc-300"
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <NameCell
                    contact={c}
                    onQuickView={onQuickView}
                    bulkMode={!!bulkMode}
                    onToggleSelect={onToggleSelect}
                  />
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="space-y-0.5 text-muted-foreground">
                    {c.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </p>
                    )}
                    {c.email && (
                      <p className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </p>
                    )}
                    {!c.phone && !c.email && (
                      <span className="text-xs">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  {meta && Icon ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
                      style={{
                        background: `${meta.color}1a`,
                        color: meta.color,
                      }}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {tags.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      tags.map((t) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px]"
                          style={{
                            background: `${t.color}1a`,
                            color: t.color,
                          }}
                        >
                          {t.name}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                  {formatRelativeTime(c.created_at)}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NameCell({
  contact,
  onQuickView,
  bulkMode,
  onToggleSelect,
}: {
  contact: Contact;
  onQuickView?: (c: Contact) => void;
  bulkMode: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const avatar = (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
      {initials(contact.name)}
    </span>
  );

  const body = (
    <div className="min-w-0">
      <p className="truncate font-medium group-hover:underline">{contact.name}</p>
      {contact.company && (
        <p className="truncate text-xs text-muted-foreground">{contact.company}</p>
      )}
    </div>
  );

  if (bulkMode) {
    return (
      <button
        type="button"
        onClick={() => onToggleSelect?.(contact.id)}
        className="group flex w-full items-center gap-3 text-left"
      >
        {avatar}
        {body}
      </button>
    );
  }

  return (
    <div className="group flex items-center gap-3">
      {onQuickView ? (
        <button
          type="button"
          onClick={() => onQuickView(contact)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          {avatar}
          {body}
        </button>
      ) : (
        <Link
          href={`/dashboard/contacts/${contact.id}`}
          className="flex flex-1 items-center gap-3"
        >
          {avatar}
          {body}
        </Link>
      )}
      {onQuickView && (
        <Link
          href={`/dashboard/contacts/${contact.id}`}
          aria-label="Buka halaman penuh"
          className="rounded-md p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-900 group-hover:opacity-100"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function SortableTh({
  column,
  sortKey,
  sortDir,
  onChange,
}: {
  column: { key: ContactSortKey; label: string; align?: "right" };
  sortKey?: ContactSortKey;
  sortDir?: SortDir;
  onChange?: (key: ContactSortKey) => void;
}) {
  const active = sortKey === column.key;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={cn(
        "px-4 py-2.5",
        column.align === "right" && "text-right",
      )}
    >
      {onChange ? (
        <button
          type="button"
          onClick={() => onChange(column.key)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-zinc-900",
            active && "text-zinc-900",
            column.align === "right" && "flex-row-reverse",
          )}
        >
          {column.label}
          <Icon className="h-3 w-3" />
        </button>
      ) : (
        <span>{column.label}</span>
      )}
    </th>
  );
}
