"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Loader2, Tag as TagIcon, Trash2, X } from "lucide-react";
import type { Tag } from "@aichat/shared";
import { Button } from "@/components/ui/button";

export function ContactsBulkBar({
  selectedCount,
  tags,
  onAttachTag,
  onDetachTag,
  onDelete,
  onClear,
  pending,
}: {
  selectedCount: number;
  tags: Tag[];
  onAttachTag: (tagId: string) => Promise<void> | void;
  onDetachTag: (tagId: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onClear: () => void;
  pending?: boolean;
}) {
  const [tagMenu, setTagMenu] = useState<"attach" | "detach" | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white shadow-sm"
    >
      <span className="text-xs font-medium">
        {selectedCount} kontak dipilih
      </span>

      <div className="relative">
        <BarBtn
          onClick={() => setTagMenu(tagMenu === "attach" ? null : "attach")}
          disabled={pending || tags.length === 0}
        >
          <TagIcon className="h-3.5 w-3.5" /> Tambah tag
        </BarBtn>
        {tagMenu === "attach" && (
          <TagMenu
            tags={tags}
            onPick={async (id) => {
              setTagMenu(null);
              await onAttachTag(id);
            }}
          />
        )}
      </div>

      <div className="relative">
        <BarBtn
          onClick={() => setTagMenu(tagMenu === "detach" ? null : "detach")}
          disabled={pending || tags.length === 0}
        >
          <TagIcon className="h-3.5 w-3.5 opacity-60" /> Lepas tag
        </BarBtn>
        {tagMenu === "detach" && (
          <TagMenu
            tags={tags}
            onPick={async (id) => {
              setTagMenu(null);
              await onDetachTag(id);
            }}
          />
        )}
      </div>

      <BarBtn danger onClick={onDelete} disabled={pending}>
        <Trash2 className="h-3.5 w-3.5" /> Hapus
      </BarBtn>

      <div className="ml-auto flex items-center gap-1">
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-white/80 hover:bg-white/10 hover:text-white"
          onClick={() => {
            setTagMenu(null);
            onClear();
          }}
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function BarBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50 " +
        (danger
          ? "text-red-200 hover:bg-red-500/20 hover:text-red-100"
          : "text-white/90 hover:bg-white/10 hover:text-white")
      }
    >
      {children}
    </button>
  );
}

function TagMenu({
  tags,
  onPick,
}: {
  tags: Tag[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-border bg-white p-1 text-zinc-900 shadow-lg">
      {tags.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onPick(t.id)}
          className="flex w-full items-center gap-2 truncate rounded-md px-2 py-1.5 text-left text-xs hover:bg-zinc-100"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: t.color }}
          />
          <span className="truncate">{t.name}</span>
        </button>
      ))}
    </div>
  );
}
