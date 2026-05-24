"use client";

import { useState } from "react";
import { Loader2, StickyNote } from "lucide-react";
import type { InternalNote as Note } from "@aichat/shared";
import { cn, formatRelativeTime, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function InternalNote({ note }: { note: Note }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 text-[10px] font-semibold text-amber-900">
          {initials(note.author_name ?? "??")}
        </span>
        <span className="font-medium text-amber-900">
          {note.author_name ?? "Anggota tim"}
        </span>
        <span className="text-muted-foreground">
          • {formatRelativeTime(note.created_at)}
        </span>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-sm text-amber-950">
        {note.body}
      </p>
    </div>
  );
}

export function InternalNoteComposer({
  onSubmit,
  pending,
}: {
  onSubmit: (body: string) => void;
  pending: boolean;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="space-y-2">
      <textarea
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Catatan internal hanya terlihat oleh tim…"
        className={cn(
          "w-full resize-none rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2 text-sm outline-none transition-colors placeholder:text-amber-900/40 focus:bg-white",
        )}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (!value.trim()) return;
            onSubmit(value.trim());
            setValue("");
          }}
          disabled={pending || value.trim().length === 0}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <StickyNote className="h-3.5 w-3.5" />
          )}
          Simpan catatan
        </Button>
      </div>
    </div>
  );
}
