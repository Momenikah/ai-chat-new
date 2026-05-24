"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  Download,
  Mail,
  Phone,
  Send,
  Users,
  X,
} from "lucide-react";
import type { SegmentWithRules, Tag } from "@aichat/shared";
import { api } from "@/lib/api";
import { initials } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CHANNEL_META } from "@/components/channels/channel-meta";

export function SegmentDetailDrawer({
  workspaceId,
  segment,
  tags,
  open,
  onClose,
}: {
  workspaceId: string | null;
  segment: SegmentWithRules | null;
  tags: Tag[];
  open: boolean;
  onClose: () => void;
}) {
  const detailQuery = useQuery({
    queryKey: ["segment", workspaceId, segment?.id],
    queryFn: () => api.segments.get(workspaceId!, segment!.id),
    enabled: open && Boolean(workspaceId && segment?.id),
  });

  const members = detailQuery.data?.members ?? [];
  const tagsById = useMemo(
    () => new Map(tags.map((t) => [t.id, t])),
    [tags],
  );

  function exportCsv() {
    if (!segment || members.length === 0) return;
    const rows = [
      ["name", "phone", "email", "company", "location", "channel"],
      ...members.map((m) => [
        m.name,
        m.phone ?? "",
        m.email ?? "",
        m.company ?? "",
        m.location ?? "",
        m.external_source ?? "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map(csvEscape).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(segment.name)}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AnimatePresence>
      {open && segment && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-zinc-950/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-border bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white"
                  style={{ background: segment.color }}
                >
                  <Users className="h-3.5 w-3.5" />
                </span>
                <p className="truncate text-sm font-semibold">
                  {segment.name}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 border-b border-border px-4 py-3">
              {segment.description && (
                <p className="text-sm text-muted-foreground">
                  {segment.description}
                </p>
              )}
              <div className="flex flex-wrap gap-1">
                {segment.rules.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    Tidak ada aturan.
                  </span>
                ) : (
                  segment.rules.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700"
                    >
                      <span className="font-medium">{r.field}</span>
                      <span className="text-zinc-500">{r.operator}</span>
                      <span className="max-w-[10rem] truncate">
                        {r.field === "tag"
                          ? tagsById.get(r.value)?.name ?? r.value.slice(0, 8)
                          : r.value}
                      </span>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs">
              <span className="font-medium text-zinc-700">
                {detailQuery.isLoading
                  ? "Memuat anggota…"
                  : `${members.length} anggota`}
              </span>
              <button
                type="button"
                onClick={exportCsv}
                disabled={members.length === 0}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40"
              >
                <Download className="h-3 w-3" /> Export CSV
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {detailQuery.isLoading ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : members.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                  Belum ada kontak yang cocok dengan aturan segment ini.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {members.map((m) => {
                    const meta = m.external_source
                      ? CHANNEL_META[m.external_source]
                      : null;
                    const ChannelIcon = meta?.icon;
                    return (
                      <li key={m.id}>
                        <Link
                          href={`/dashboard/contacts/${m.id}`}
                          className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                            {initials(m.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {m.name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {m.phone && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Phone className="h-2.5 w-2.5" />
                                  {m.phone}
                                </span>
                              )}
                              {m.email && (
                                <span className="inline-flex items-center gap-0.5 truncate">
                                  <Mail className="h-2.5 w-2.5" />
                                  {m.email}
                                </span>
                              )}
                            </div>
                          </div>
                          {meta && ChannelIcon && (
                            <ChannelIcon
                              className="h-3.5 w-3.5 shrink-0"
                              style={{ color: meta.color }}
                            />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-border bg-zinc-50/60 p-3">
              <Button asChild className="w-full">
                <Link
                  href={`/dashboard/broadcasts/new?segment=${segment.id}`}
                >
                  <Send className="h-4 w-4" /> Broadcast ke segment ini
                </Link>
              </Button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function csvEscape(v: string) {
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
