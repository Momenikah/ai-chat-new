"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Globe,
  Layers,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import type {
  KnowledgeDocument,
  KnowledgeSource,
  KnowledgeStatus,
} from "@aichat/shared";

export function DocDetailDrawer({
  doc,
  open,
  onClose,
}: {
  doc: KnowledgeDocument | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && doc && (
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
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-lg flex-col border-l border-border bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <SourceIcon kind={doc.source_kind} />
                <p className="truncate text-sm font-semibold">{doc.title}</p>
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

            <div className="space-y-3 border-b border-border px-4 py-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={doc.status} />
                <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-600">
                  <Layers className="h-3 w-3" /> {doc.chunk_count} chunk
                </span>
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 capitalize text-zinc-600">
                  {doc.source_kind}
                </span>
              </div>
              <p className="text-muted-foreground">
                Dibuat {new Date(doc.created_at).toLocaleString("id-ID")}
              </p>
              {doc.source_url && (
                <a
                  href={doc.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sky-600 hover:underline"
                >
                  {doc.source_url}
                </a>
              )}
              {doc.mime_type && (
                <p className="font-mono text-[10px] text-muted-foreground">
                  {doc.mime_type}
                </p>
              )}
              {doc.error_message && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-red-600">
                  {doc.error_message}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Konten mentah
              </p>
              {doc.raw_content ? (
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700">
                  {doc.raw_content}
                </pre>
              ) : (
                <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  Konten mentah tidak tersedia untuk ditampilkan.
                </p>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SourceIcon({ kind }: { kind: KnowledgeSource }) {
  const Icon = kind === "url" ? Globe : kind === "upload" ? Upload : FileText;
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100">
      <Icon className="h-3.5 w-3.5 text-zinc-600" />
    </div>
  );
}

function StatusBadge({ status }: { status: KnowledgeStatus }) {
  const map: Record<
    KnowledgeStatus,
    { label: string; cls: string; Icon: typeof CheckCircle2 }
  > = {
    processing: {
      label: "Memproses",
      cls: "bg-amber-50 text-amber-700",
      Icon: Clock3,
    },
    ready: { label: "Siap", cls: "bg-emerald-50 text-emerald-700", Icon: CheckCircle2 },
    failed: { label: "Gagal", cls: "bg-red-50 text-red-700", Icon: XCircle },
  };
  const { label, cls, Icon } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${cls}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
