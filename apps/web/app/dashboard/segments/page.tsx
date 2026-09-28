"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Copy,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import type { SegmentWithRules, Tag } from "@aichat/shared";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SegmentsStats } from "@/components/segments/segments-stats";
import { SegmentDetailDrawer } from "@/components/segments/segment-detail-drawer";
import {
  SegmentDialog,
  type SegmentDialogMode,
} from "@/components/segments/segment-dialog";

type SortKey = "newest" | "largest" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Terbaru" },
  { key: "largest", label: "Anggota terbanyak" },
  { key: "name", label: "Nama A–Z" },
];

export default function SegmentsPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const can = useWorkspaceStore((s) => s.can);
  const canManage = can("ADMIN");

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [drawerSegment, setDrawerSegment] = useState<SegmentWithRules | null>(
    null,
  );
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    mode: SegmentDialogMode;
    source: SegmentWithRules | null;
  }>({ open: false, mode: "create", source: null });

  const segmentsQuery = useQuery({
    queryKey: ["segments", workspaceId],
    queryFn: () => api.segments.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const tagsQuery = useQuery({
    queryKey: ["tags", workspaceId],
    queryFn: () => api.tags.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const segments = useMemo(
    () => segmentsQuery.data?.segments ?? [],
    [segmentsQuery.data],
  );
  const tags = tagsQuery.data?.tags ?? [];

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? segments.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.description ?? "").toLowerCase().includes(q),
        )
      : segments.slice();

    filtered.sort((a, b) => {
      switch (sort) {
        case "largest":
          return b.member_count - a.member_count;
        case "name":
          return a.name.localeCompare(b.name, "id");
        case "newest":
        default:
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
      }
    });
    return filtered;
  }, [segments, search, sort]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["segments", workspaceId] });

  function openDialog(mode: SegmentDialogMode, source: SegmentWithRules | null) {
    setDialogState({ open: true, mode, source });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-5xl space-y-5"
    >
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Segment</h1>
          <p className="text-sm text-muted-foreground">
            Kumpulan kontak berbasis aturan untuk broadcast & filter.
          </p>
        </div>
        {canManage && workspaceId && (
          <Button onClick={() => openDialog("create", null)}>
            <Plus className="h-4 w-4" /> Segment baru
          </Button>
        )}
      </div>

      {segmentsQuery.isLoading ? (
        <Skeleton className="h-[88px] rounded-xl" />
      ) : (
        <SegmentsStats segments={segments} />
      )}

      {segments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari segment…"
              className="h-9 w-full rounded-lg border border-input bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:bg-white"
            />
          </div>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-9 w-48 text-sm"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                Urutkan: {s.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      {segmentsQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : segments.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <Users className="h-6 w-6 text-zinc-500" />
          </div>
          <p className="font-medium">Belum ada segment</p>
          <p className="text-sm text-muted-foreground">
            Buat segment pertama untuk mengelompokkan kontak.
          </p>
          {canManage && (
            <Button
              className="mt-2"
              onClick={() => openDialog("create", null)}
            >
              <Plus className="h-4 w-4" /> Segment baru
            </Button>
          )}
        </Card>
      ) : filteredAndSorted.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          Tidak ada segment cocok dengan pencarian.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredAndSorted.map((s, i) => (
            <SegmentCard
              key={s.id}
              segment={s}
              tags={tags}
              canManage={canManage}
              index={i}
              workspaceId={workspaceId as string}
              onOpen={() => setDrawerSegment(s)}
              onEdit={() => openDialog("edit", s)}
              onDuplicate={() => openDialog("duplicate", s)}
              onDeleted={invalidate}
            />
          ))}
        </div>
      )}

      <SegmentDetailDrawer
        workspaceId={workspaceId}
        segment={drawerSegment}
        tags={tags}
        open={drawerSegment !== null}
        onClose={() => setDrawerSegment(null)}
      />

      {workspaceId && (
        <SegmentDialog
          workspaceId={workspaceId}
          tags={tags}
          source={dialogState.source}
          mode={dialogState.mode}
          open={dialogState.open}
          onOpenChange={(open) =>
            setDialogState((s) => ({ ...s, open }))
          }
          onSaved={invalidate}
        />
      )}
    </motion.div>
  );
}

function SegmentCard({
  segment,
  tags,
  canManage,
  index,
  workspaceId,
  onOpen,
  onEdit,
  onDuplicate,
  onDeleted,
}: {
  segment: SegmentWithRules;
  tags: Tag[];
  canManage: boolean;
  index: number;
  workspaceId: string;
  onOpen: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDeleted: () => void;
}) {
  const deleteMutation = useMutation({
    mutationFn: () => api.segments.remove(workspaceId, segment.id),
    onSuccess: onDeleted,
  });
  const tagsById = useMemo(
    () => new Map(tags.map((t) => [t.id, t])),
    [tags],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
      whileHover={{ y: -2 }}
    >
      <Card className="overflow-hidden p-5 transition-shadow hover:shadow-md">
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-start gap-3 text-left"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ background: segment.color }}
          >
            <Users className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{segment.name}</p>
            {segment.description && (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {segment.description}
              </p>
            )}
          </div>
          <Badge variant="secondary">{segment.member_count} kontak</Badge>
        </button>

        <ul className="mt-4 space-y-1 text-xs">
          {segment.rules.length === 0 ? (
            <li className="text-muted-foreground">Tidak ada aturan.</li>
          ) : (
            segment.rules.slice(0, 3).map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-1.5 rounded-md bg-zinc-50 px-2 py-1"
              >
                <span className="font-medium">{r.field}</span>
                <span className="text-muted-foreground">{r.operator}</span>
                <span className="truncate">
                  {r.field === "tag"
                    ? tagsById.get(r.value)?.name ?? r.value.slice(0, 8)
                    : r.value}
                </span>
              </li>
            ))
          )}
          {segment.rules.length > 3 && (
            <li className="text-[10px] text-muted-foreground">
              +{segment.rules.length - 3} aturan lain
            </li>
          )}
        </ul>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/broadcasts/new?segment=${segment.id}`}>
              <Send className="h-3.5 w-3.5" /> Broadcast
            </Link>
          </Button>

          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-zinc-500 hover:text-zinc-900"
                  aria-label="Aksi segment"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onEdit()}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onDuplicate()}>
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:bg-red-50 focus:text-red-700"
                  onSelect={() => {
                    if (confirm(`Hapus segment "${segment.name}"?`)) {
                      deleteMutation.mutate();
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
