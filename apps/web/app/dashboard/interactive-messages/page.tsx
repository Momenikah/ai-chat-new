"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Copy,
  Edit2,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import type {
  CarouselPayload,
  InteractiveKind,
  InteractiveMessage,
  ListPayload,
  ReplyButtonsPayload,
} from "@aichat/shared";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KIND_META, emptyPayload } from "@/components/interactive/interactive-shared";
import { InteractiveStats } from "@/components/interactive/interactive-stats";
import {
  InteractiveStarterGallery,
} from "@/components/interactive/starter-gallery";
import {
  BuilderDialog,
  type BuilderInitial,
} from "@/components/interactive/builder-dialog";

type KindFilter = "all" | InteractiveKind;

const KIND_FILTERS: { key: KindFilter; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "reply_buttons", label: "Reply buttons" },
  { key: "list", label: "List" },
  { key: "carousel", label: "Carousel" },
];

export default function InteractiveMessagesPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const can = useWorkspaceStore((s) => s.can);
  const canManage = can("AGENT");

  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [builder, setBuilder] = useState<BuilderInitial | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["interactives", workspaceId],
    queryFn: () => api.interactives.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const items = useMemo(() => data?.interactive_messages ?? [], [data]);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["interactives", workspaceId] });

  const counts = useMemo(() => {
    const c: Record<KindFilter, number> = {
      all: items.length,
      reply_buttons: 0,
      list: 0,
      carousel: 0,
    };
    for (const i of items) c[i.kind]++;
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (kindFilter !== "all" && i.kind !== kindFilter) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, kindFilter, search]);

  function duplicate(item: InteractiveMessage) {
    setBuilder({
      mode: "duplicate",
      name: `${item.name}_copy`,
      kind: item.kind,
      payload: item.payload,
    });
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
          <h1 className="text-xl font-semibold tracking-tight">
            Interactive Messages
          </h1>
          <p className="text-sm text-muted-foreground">
            Builder untuk reply buttons, list selector, dan media carousel.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setGalleryOpen(true)}>
            <Plus className="h-4 w-4" /> Interactive baru
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-[80px] rounded-xl" />
      ) : (
        <InteractiveStats items={items} />
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama…"
              className="h-9 w-full rounded-lg border border-input bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:bg-white"
            />
          </div>
          <div className="flex gap-1.5">
            {KIND_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setKindFilter(f.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  kindFilter === f.key
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px]",
                    kindFilter === f.key
                      ? "bg-white/15 text-white"
                      : "bg-zinc-100 text-zinc-500",
                  )}
                >
                  {counts[f.key]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <Sparkles className="h-6 w-6 text-zinc-500" />
          </div>
          <p className="font-medium">Belum ada interactive message</p>
          {canManage && (
            <Button onClick={() => setGalleryOpen(true)} className="mt-2">
              <Plus className="h-4 w-4" /> Interactive baru
            </Button>
          )}
        </Card>
      ) : visible.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          Tidak ada interactive message yang cocok.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((im, i) => (
            <InteractiveCard
              key={im.id}
              item={im}
              index={i}
              workspaceId={workspaceId as string}
              canManage={canManage}
              onChanged={invalidate}
              onEdit={() => setBuilder({ mode: "edit", item: im })}
              onDuplicate={() => duplicate(im)}
            />
          ))}
        </div>
      )}

      <InteractiveStarterGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onBlank={() => {
          setGalleryOpen(false);
          setBuilder({
            mode: "create",
            name: "",
            kind: "reply_buttons",
            payload: emptyPayload("reply_buttons"),
          });
        }}
        onPick={(preset) => {
          setGalleryOpen(false);
          setBuilder({
            mode: "create",
            name: preset.name,
            kind: preset.kind,
            payload: preset.payload,
          });
        }}
      />

      {workspaceId && builder && (
        <BuilderDialog
          workspaceId={workspaceId}
          initial={builder}
          onClose={() => setBuilder(null)}
          onSaved={() => {
            invalidate();
            setBuilder(null);
          }}
        />
      )}
    </motion.div>
  );
}

function InteractiveCard({
  item,
  index,
  workspaceId,
  canManage,
  onChanged,
  onEdit,
  onDuplicate,
}: {
  item: InteractiveMessage;
  index: number;
  workspaceId: string;
  canManage: boolean;
  onChanged: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  const remove = useMutation({
    mutationFn: () => api.interactives.remove(workspaceId, item.id),
    onSuccess: onChanged,
  });
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
      whileHover={{ y: -2 }}
    >
      <Card className="p-5 transition-shadow hover:shadow-md">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">{meta.label}</p>
          </div>
          <Badge variant="secondary">{item.kind}</Badge>
        </div>
        <InteractivePreviewMini item={item} />
        {canManage && (
          <div className="mt-3 flex justify-end gap-1 border-t border-border pt-3">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={onDuplicate}
              aria-label="Duplicate"
              title="Duplicate"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={onEdit}
              aria-label="Edit"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-red-600 hover:bg-red-50"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm(`Hapus "${item.name}"?`)) remove.mutate();
              }}
              aria-label="Hapus"
            >
              {remove.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function InteractivePreviewMini({ item }: { item: InteractiveMessage }) {
  if (item.kind === "reply_buttons") {
    const p = item.payload as ReplyButtonsPayload;
    return (
      <div className="mt-3 rounded-lg bg-zinc-50 p-2 text-xs">
        <p className="text-zinc-700">{p.body || "(no body)"}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {(p.buttons ?? []).map((b) => (
            <span
              key={b.id}
              className="rounded-md bg-white px-2 py-0.5 text-[11px] text-sky-600 ring-1 ring-zinc-200"
            >
              {b.title || "(button)"}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (item.kind === "list") {
    const p = item.payload as ListPayload;
    const rowCount = (p.sections ?? []).reduce(
      (acc, s) => acc + (s.rows?.length ?? 0),
      0,
    );
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        {p.sections?.length ?? 0} section · {rowCount} row · button:{" "}
        <code>{p.button_text}</code>
      </p>
    );
  }
  const p = item.payload as CarouselPayload;
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      {p.cards?.length ?? 0} kartu carousel
    </p>
  );
}
