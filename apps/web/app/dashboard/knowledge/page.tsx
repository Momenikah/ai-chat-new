"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  Globe,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import type {
  KnowledgeDocument,
  KnowledgeSource,
  KnowledgeStatus,
} from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { KnowledgeStats } from "@/components/knowledge/knowledge-stats";
import { RagTester } from "@/components/knowledge/rag-tester";
import { DocDetailDrawer } from "@/components/knowledge/doc-detail-drawer";

type StatusFilter = "all" | KnowledgeStatus;
type SourceFilter = "all" | KnowledgeSource;

export default function KnowledgePage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const can = useWorkspaceStore((s) => s.can);
  const canManage = can("ADMIN");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [detailDoc, setDetailDoc] = useState<KnowledgeDocument | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge", workspaceId],
    queryFn: () => api.knowledge.list(workspaceId as string),
    enabled: Boolean(workspaceId),
    // Poll while any document is still processing so badges flip automatically.
    refetchInterval: (query) =>
      query.state.data?.documents.some((d) => d.status === "processing")
        ? 4000
        : false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["knowledge", workspaceId] });

  const docs = useMemo(() => data?.documents ?? [], [data]);
  const processingCount = docs.filter((d) => d.status === "processing").length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (sourceFilter !== "all" && d.source_kind !== sourceFilter) return false;
      if (q && !d.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, search, statusFilter, sourceFilter]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-4xl space-y-5"
    >
      <div className="flex items-end justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Knowledge Base</h1>
            <p className="text-sm text-muted-foreground">
              Dokumen, artikel, dan URL yang dijadikan rujukan RAG oleh agent AI.
            </p>
          </div>
        </div>
        {canManage && workspaceId && (
          <div className="flex gap-2">
            <UploadDialog workspaceId={workspaceId} onSaved={invalidate} />
            <ManualDialog workspaceId={workspaceId} onSaved={invalidate} />
          </div>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-[88px] rounded-xl" />
      ) : (
        <KnowledgeStats docs={docs} />
      )}

      {workspaceId && docs.length > 0 && <RagTester workspaceId={workspaceId} />}

      {docs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul dokumen…"
              className="h-9 w-full rounded-lg border border-input bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:bg-white"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-9 w-36 text-sm"
          >
            <option value="all">Semua status</option>
            <option value="ready">Siap</option>
            <option value="processing">Memproses</option>
            <option value="failed">Gagal</option>
          </Select>
          <Select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="h-9 w-36 text-sm"
          >
            <option value="all">Semua sumber</option>
            <option value="upload">Upload</option>
            <option value="manual">Manual</option>
            <option value="url">URL</option>
          </Select>
          {processingCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              <Loader2 className="h-3 w-3 animate-spin" />
              {processingCount} memproses
            </span>
          )}
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : docs.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <BookOpen className="h-6 w-6 text-zinc-500" />
          </div>
          <p className="font-medium">Knowledge base masih kosong</p>
          <p className="text-sm text-muted-foreground">
            Unggah .txt/.md/.pdf atau tambah artikel manual untuk mulai melatih agent.
          </p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          Tidak ada dokumen yang cocok dengan filter.
        </Card>
      ) : (
        <ul className="space-y-2">
          {visible.map((d) => (
            <DocRow
              key={d.id}
              doc={d}
              canManage={canManage}
              workspaceId={workspaceId as string}
              onChanged={invalidate}
              onOpen={() => setDetailDoc(d)}
            />
          ))}
        </ul>
      )}

      <DocDetailDrawer
        doc={detailDoc}
        open={detailDoc !== null}
        onClose={() => setDetailDoc(null)}
      />
    </motion.div>
  );
}

function DocRow({
  doc,
  canManage,
  workspaceId,
  onChanged,
  onOpen,
}: {
  doc: KnowledgeDocument;
  canManage: boolean;
  workspaceId: string;
  onChanged: () => void;
  onOpen: () => void;
}) {
  const remove = useMutation({
    mutationFn: () => api.knowledge.remove(workspaceId, doc.id),
    onSuccess: onChanged,
  });
  return (
    <li>
      <Card className="flex items-start gap-3 p-4">
        <SourceIcon kind={doc.source_kind} />
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <p className="truncate font-medium hover:underline">{doc.title}</p>
            <StatusBadge status={doc.status} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {doc.chunk_count} chunk • {new Date(doc.created_at).toLocaleString("id-ID")}
            {doc.source_url ? ` • ${doc.source_url}` : ""}
          </p>
          {doc.error_message && (
            <p className="mt-1 text-xs text-red-600">{doc.error_message}</p>
          )}
        </button>
        {canManage && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-red-600 hover:bg-red-50"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm(`Hapus dokumen "${doc.title}"?`)) remove.mutate();
            }}
          >
            {remove.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </Card>
    </li>
  );
}

function SourceIcon({ kind }: { kind: KnowledgeSource }) {
  const Icon = kind === "url" ? Globe : kind === "upload" ? Upload : FileText;
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
      <Icon className="h-4 w-4 text-zinc-600" />
    </div>
  );
}

function StatusBadge({ status }: { status: KnowledgeStatus }) {
  const map: Record<KnowledgeStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    processing: { label: "Memproses", cls: "bg-amber-50 text-amber-700", Icon: Clock3 },
    ready: { label: "Siap", cls: "bg-emerald-50 text-emerald-700", Icon: CheckCircle2 },
    failed: { label: "Gagal", cls: "bg-red-50 text-red-700", Icon: XCircle },
  };
  const { label, cls, Icon } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function UploadDialog({
  workspaceId,
  onSaved,
}: {
  workspaceId: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useMutation({
    mutationFn: () => api.knowledge.upload(workspaceId, file as File, title || undefined),
    onSuccess: () => {
      onSaved();
      setOpen(false);
      setFile(null);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
    },
  });
  const err = mutation.error instanceof ApiException ? mutation.error.message : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4" /> Upload file
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload dokumen</DialogTitle>
        </DialogHeader>
        <form
          id="kn-upload"
          onSubmit={(e) => {
            e.preventDefault();
            if (file) mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="kn-title">Judul (opsional)</Label>
            <Input
              id="kn-title"
              placeholder="Kebijakan retur"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kn-file">File (.txt, .md, .pdf, maks 5MB)</Label>
            <input
              id="kn-file"
              ref={inputRef}
              type="file"
              accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Untuk PDF, pastikan teks dapat di-extract (bukan scan tanpa OCR).
            </p>
          </div>
          {err && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>
          )}
        </form>
        <DialogFooter>
          <Button type="submit" form="kn-upload" disabled={mutation.isPending || !file}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Unggah
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualDialog({
  workspaceId,
  onSaved,
}: {
  workspaceId: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    source_kind: "manual" as "manual" | "url",
    source_url: "",
    content: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.knowledge.create(workspaceId, {
        title: form.title,
        source_kind: form.source_kind,
        source_url: form.source_kind === "url" ? form.source_url : undefined,
        content: form.content,
      }),
    onSuccess: () => {
      onSaved();
      setOpen(false);
      setForm({ title: "", source_kind: "manual", source_url: "", content: "" });
    },
  });
  const err = mutation.error instanceof ApiException ? mutation.error.message : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Artikel baru
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Artikel manual atau URL</DialogTitle>
        </DialogHeader>
        <form
          id="kn-manual"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="kn-mtitle">Judul</Label>
            <Input
              id="kn-mtitle"
              required
              placeholder="FAQ — Pengiriman"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kn-kind">Sumber</Label>
            <Select
              id="kn-kind"
              value={form.source_kind}
              onChange={(e) =>
                setForm({ ...form, source_kind: e.target.value as "manual" | "url" })
              }
            >
              <option value="manual">Artikel manual</option>
              <option value="url">URL (paste teksnya)</option>
            </Select>
          </div>
          {form.source_kind === "url" && (
            <div className="space-y-2">
              <Label htmlFor="kn-url">URL</Label>
              <Input
                id="kn-url"
                type="url"
                placeholder="https://docs.example.com/faq"
                value={form.source_url}
                onChange={(e) => setForm({ ...form, source_url: e.target.value })}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="kn-content">Isi</Label>
            <textarea
              id="kn-content"
              rows={10}
              required
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Tempel atau ketik konten yang ingin dijadikan rujukan agent…"
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            />
          </div>
          {err && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>
          )}
        </form>
        <DialogFooter>
          <Button type="submit" form="kn-manual" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
