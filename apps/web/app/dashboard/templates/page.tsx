"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import type {
  MessageTemplate,
  TemplateCategory,
  TemplateStatus,
} from "@aichat/shared";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TemplatesStats } from "@/components/templates/templates-stats";
import { StarterGallery } from "@/components/templates/starter-gallery";

const STATUS_FILTERS: { key: "all" | TemplateStatus; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "draft", label: "Draft" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const STATUS_META: Record<
  TemplateStatus,
  {
    label: string;
    variant: "success" | "warning" | "secondary" | "destructive";
    icon: typeof CheckCircle2;
  }
> = {
  draft: { label: "draft", variant: "secondary", icon: FileText },
  pending: { label: "pending", variant: "warning", icon: Clock },
  approved: { label: "approved", variant: "success", icon: CheckCircle2 },
  rejected: { label: "rejected", variant: "destructive", icon: XCircle },
};

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const can = useWorkspaceStore((s) => s.can);
  const canManage = can("AGENT");

  const [status, setStatus] = useState<"all" | TemplateStatus>("all");
  const [category, setCategory] = useState<"all" | TemplateCategory>("all");
  const [search, setSearch] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["templates", workspaceId],
    queryFn: () => api.templates.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const all = useMemo(() => data?.templates ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (category !== "all" && t.category !== category) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, status, category, search]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-5xl space-y-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Message Templates
          </h1>
          <p className="text-sm text-muted-foreground">
            Template terstruktur dengan variabel dan reply buttons.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setGalleryOpen(true)}>
            <Plus className="h-4 w-4" /> Template baru
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-[88px] rounded-xl" />
      ) : (
        <TemplatesStats templates={all} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama template…"
            className="h-9 w-full rounded-lg border border-input bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:bg-white"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-full bg-zinc-100 p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                status === f.key
                  ? "bg-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Select
          className="h-8 w-44 text-xs"
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as "all" | TemplateCategory)
          }
        >
          <option value="all">Semua kategori</option>
          <option value="marketing">marketing</option>
          <option value="utility">utility</option>
          <option value="authentication">authentication</option>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <FileText className="h-6 w-6 text-zinc-500" />
          </div>
          <p className="font-medium">Belum ada template</p>
          <p className="text-sm text-muted-foreground">
            Buat template pertama untuk dipakai berulang.
          </p>
          {canManage && (
            <Button className="mt-2" onClick={() => setGalleryOpen(true)}>
              <Plus className="h-4 w-4" /> Template baru
            </Button>
          )}
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          Tidak ada template cocok dengan filter ini.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((t, i) => (
            <TemplateCard
              key={t.id}
              template={t}
              index={i}
              canManage={canManage}
              workspaceId={workspaceId as string}
              onChanged={() =>
                queryClient.invalidateQueries({
                  queryKey: ["templates", workspaceId],
                })
              }
            />
          ))}
        </div>
      )}

      <StarterGallery open={galleryOpen} onOpenChange={setGalleryOpen} />
    </motion.div>
  );
}

function TemplateCard({
  template,
  index,
  canManage,
  workspaceId,
  onChanged,
}: {
  template: MessageTemplate;
  index: number;
  canManage: boolean;
  workspaceId: string;
  onChanged: () => void;
}) {
  const status = STATUS_META[template.status];
  const Icon = status.icon;

  const remove = useMutation({
    mutationFn: () => api.templates.remove(workspaceId, template.id),
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
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
            <FileText className="h-4 w-4 text-zinc-700" />
          </span>
          <div className="min-w-0 flex-1">
            <Link
              href={`/dashboard/templates/${template.id}`}
              className="font-medium hover:underline"
            >
              {template.name}
            </Link>
            <p className="text-xs capitalize text-muted-foreground">
              {template.category} · {template.language}
            </p>
          </div>
          <Badge variant={status.variant} className="gap-1">
            <Icon className="h-3 w-3" />
            {status.label}
          </Badge>
        </div>
        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
          {template.body}
        </p>
        {canManage && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
            <Button size="sm" variant="outline" asChild>
              <Link
                href={`/dashboard/templates/new?from=${template.id}`}
                title="Duplicate template"
              >
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </Link>
            </Button>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" asChild>
                <Link href={`/dashboard/templates/${template.id}`}>Buka</Link>
              </Button>
              {(template.status === "draft" || template.status === "rejected") && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-red-600 hover:bg-red-50"
                  onClick={() => {
                    if (confirm(`Hapus template "${template.name}"?`)) {
                      remove.mutate();
                    }
                  }}
                  disabled={remove.isPending}
                >
                  {remove.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
