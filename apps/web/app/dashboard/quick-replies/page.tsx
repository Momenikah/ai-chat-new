"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Check,
  Copy,
  CopyPlus,
  Edit2,
  Loader2,
  Plus,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import type { QuickReply } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuickRepliesStats } from "@/components/quick-replies/quick-replies-stats";
import {
  QuickReplyStarterGallery,
  type QuickReplyStarter,
} from "@/components/quick-replies/starter-gallery";

const BODY_SOFT_LIMIT = 1000;

type DialogInitial =
  | { mode: "create"; shortcut: string; body: string }
  | { mode: "edit"; reply: QuickReply };

export default function QuickRepliesPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const can = useWorkspaceStore((s) => s.can);
  const canManage = can("AGENT");

  const [search, setSearch] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogInitial | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["quick-replies", workspaceId],
    queryFn: () => api.quickReplies.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const replies = useMemo(() => data?.quick_replies ?? [], [data]);
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["quick-replies", workspaceId],
    });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return replies;
    return replies.filter(
      (r) =>
        r.shortcut.toLowerCase().includes(q) ||
        r.body.toLowerCase().includes(q),
    );
  }, [replies, search]);

  function openCreate(preset?: QuickReplyStarter) {
    if (preset) {
      // Append "_2" if the shortcut already exists, to avoid 409 on save.
      let shortcut = preset.shortcut;
      let i = 2;
      while (replies.some((r) => r.shortcut === shortcut)) {
        shortcut = `${preset.shortcut}_${i++}`;
      }
      setDialog({ mode: "create", shortcut, body: preset.body });
    } else {
      setDialog({ mode: "create", shortcut: "", body: "" });
    }
  }

  function openDuplicate(r: QuickReply) {
    let shortcut = `${r.shortcut}_copy`;
    let i = 2;
    while (replies.some((x) => x.shortcut === shortcut)) {
      shortcut = `${r.shortcut}_copy${i++}`;
    }
    setDialog({ mode: "create", shortcut, body: r.body });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-4xl space-y-5"
    >
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Quick Reply</h1>
          <p className="text-sm text-muted-foreground">
            Snippet pendek yang bisa dipakai agent di composer inbox via
            shortcut.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setGalleryOpen(true)}>
            <Plus className="h-4 w-4" /> Quick reply baru
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-[88px] rounded-xl" />
      ) : (
        <QuickRepliesStats replies={replies} />
      )}

      {replies.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari shortcut atau isi balasan…"
            className="h-9 w-full rounded-lg border border-input bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:bg-white"
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : replies.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <Zap className="h-6 w-6 text-zinc-500" />
          </div>
          <p className="font-medium">Belum ada quick reply</p>
          <p className="text-sm text-muted-foreground">
            Tambahkan shortcut untuk balasan yang sering dipakai.
          </p>
          {canManage && (
            <Button onClick={() => setGalleryOpen(true)} className="mt-2">
              <Plus className="h-4 w-4" /> Quick reply baru
            </Button>
          )}
        </Card>
      ) : visible.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          Tidak ada quick reply yang cocok.
        </Card>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => (
            <QuickReplyRow
              key={r.id}
              reply={r}
              canManage={canManage}
              workspaceId={workspaceId as string}
              onChanged={invalidate}
              onEdit={() => setDialog({ mode: "edit", reply: r })}
              onDuplicate={() => openDuplicate(r)}
            />
          ))}
        </ul>
      )}

      <QuickReplyStarterGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onPick={(preset) => {
          setGalleryOpen(false);
          openCreate(preset.key === "blank" ? undefined : preset);
        }}
      />

      {workspaceId && dialog && (
        <QuickReplyDialog
          workspaceId={workspaceId}
          initial={dialog}
          existingShortcuts={replies.map((r) => r.shortcut)}
          onClose={() => setDialog(null)}
          onSaved={() => {
            invalidate();
            setDialog(null);
          }}
        />
      )}
    </motion.div>
  );
}

/* ------------------------------ Row ----------------------------------- */

function QuickReplyRow({
  reply,
  canManage,
  workspaceId,
  onChanged,
  onEdit,
  onDuplicate,
}: {
  reply: QuickReply;
  canManage: boolean;
  workspaceId: string;
  onChanged: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const remove = useMutation({
    mutationFn: () => api.quickReplies.remove(workspaceId, reply.id),
    onSuccess: onChanged,
  });

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(reply.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may be blocked; silently ignore.
    }
  }

  const variableCount = useMemo(() => {
    const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(reply.body)) !== null) seen.add(m[1]);
    return seen.size;
  }, [reply.body]);

  return (
    <li>
      <Card className="flex items-start gap-3 p-4">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-zinc-900 px-2 py-0.5 text-xs font-mono text-white">
          /{reply.shortcut}
        </span>
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap text-sm">{reply.body}</p>
          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>{reply.body.length} char</span>
            {variableCount > 0 && (
              <span className="rounded bg-violet-100 px-1.5 py-px text-violet-700">
                {variableCount} variabel
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={copyBody}
            aria-label="Copy isi balasan"
            title={copied ? "Tersalin!" : "Copy ke clipboard"}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          {canManage && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={onDuplicate}
                aria-label="Duplicate"
                title="Duplicate"
              >
                <CopyPlus className="h-3.5 w-3.5" />
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
                onClick={() => {
                  if (confirm(`Hapus /${reply.shortcut}?`)) remove.mutate();
                }}
                disabled={remove.isPending}
                aria-label="Hapus"
              >
                {remove.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </>
          )}
        </div>
      </Card>
    </li>
  );
}

/* ------------------------------ Dialog -------------------------------- */

function QuickReplyDialog({
  workspaceId,
  initial,
  existingShortcuts,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  initial: DialogInitial;
  existingShortcuts: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [shortcut, setShortcut] = useState(
    initial.mode === "edit" ? initial.reply.shortcut : initial.shortcut,
  );
  const [body, setBody] = useState(
    initial.mode === "edit" ? initial.reply.body : initial.body,
  );

  const isEdit = initial.mode === "edit";
  const conflict =
    shortcut.length > 0 &&
    existingShortcuts.includes(shortcut) &&
    (!isEdit || shortcut !== initial.reply.shortcut);

  const variables = useMemo(() => extractVariables(body), [body]);
  const rendered = useMemo(
    () =>
      body.replace(
        /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
        (_m, name) => SAMPLE_VALUES[name] ?? `[${name}]`,
      ),
    [body],
  );

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? api.quickReplies.update(workspaceId, initial.reply.id, {
            shortcut,
            body,
          })
        : api.quickReplies.create(workspaceId, { shortcut, body }),
    onSuccess: onSaved,
  });

  const error =
    mutation.error instanceof ApiException ? mutation.error.message : null;

  const charClass =
    body.length > BODY_SOFT_LIMIT
      ? "text-red-600 font-semibold"
      : body.length > BODY_SOFT_LIMIT * 0.9
        ? "text-amber-600"
        : "text-muted-foreground";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit quick reply" : "Quick reply baru"}
          </DialogTitle>
        </DialogHeader>

        <form
          id="qr-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (conflict) return;
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="qr-shortcut">Shortcut</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/</span>
              <Input
                id="qr-shortcut"
                required
                placeholder="greet"
                value={shortcut}
                onChange={(e) =>
                  setShortcut(e.target.value.replace(/^\/+/, "").trim())
                }
                className={conflict ? "border-red-300" : ""}
              />
            </div>
            {conflict && (
              <p className="text-xs text-red-600">
                Shortcut <code>/{shortcut}</code> sudah dipakai. Pilih nama
                lain.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="qr-body">Isi balasan</Label>
              <span className={`tabular-nums text-[11px] ${charClass}`}>
                {body.length} char
              </span>
            </div>
            <textarea
              id="qr-body"
              rows={4}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Halo {{name}}! Terima kasih sudah menghubungi kami."
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            />

            <VariablesPanel
              variables={variables}
              onInsert={(name) => setBody((b) => `${b}{{${name}}}`)}
            />

            {body.trim().length > 0 && (
              <div className="rounded-lg border border-dashed border-border bg-zinc-50/60 p-3">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Preview dengan sample value
                </p>
                <p className="whitespace-pre-wrap text-sm">{rendered}</p>
              </div>
            )}
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button
            type="submit"
            form="qr-form"
            disabled={mutation.isPending || conflict}
          >
            {mutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VariablesPanel({
  variables,
  onInsert,
}: {
  variables: string[];
  onInsert: (name: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Variabel terdeteksi</span>
        <span className="rounded bg-zinc-100 px-1 py-px text-zinc-600">
          {variables.length}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {variables.length === 0 && (
          <span className="text-[11px] text-muted-foreground">
            Belum ada — sisipkan dengan tombol di bawah atau ketik{" "}
            <code>{`{{name}}`}</code>.
          </span>
        )}
        {variables.map((v) => (
          <span
            key={v}
            className="inline-flex items-center rounded-md bg-violet-100 px-1.5 py-0.5 font-mono text-[11px] text-violet-700"
          >
            {`{{${v}}}`}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Sisipkan:</span>
        {SUGGESTED_VARS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onInsert(s)}
            className={cn(
              "rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[11px] hover:bg-zinc-50",
            )}
          >
            {`{{${s}}}`}
          </button>
        ))}
      </div>
    </div>
  );
}

const SUGGESTED_VARS = ["name", "phone", "email", "company"];

const SAMPLE_VALUES: Record<string, string> = {
  name: "Andi",
  phone: "081234567890",
  email: "andi@example.com",
  company: "PT Maju",
  hours: "09:00–17:00",
  link: "https://example.com",
};

function extractVariables(body: string): string[] {
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) seen.add(m[1]);
  return Array.from(seen);
}

