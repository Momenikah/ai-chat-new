"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import type { Tag } from "@aichat/shared";
import { cn } from "@/lib/utils";

export function TagEditor({
  attached,
  available,
  onAttach,
  onDetach,
  disabled,
}: {
  attached: Tag[];
  available: Tag[];
  onAttach: (tagId: string) => void;
  onDetach: (tagId: string) => void;
  disabled?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const attachedIds = new Set(attached.map((t) => t.id));
  const pickable = available.filter((t) => !attachedIds.has(t.id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {attached.length === 0 && (
          <span className="text-xs text-muted-foreground">
            Belum ada tag.
          </span>
        )}
        {attached.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
            style={{ background: `${t.color}1a`, color: t.color }}
          >
            {t.name}
            {!disabled && (
              <button
                onClick={() => onDetach(t.id)}
                className="ml-0.5 rounded-full hover:bg-black/10"
                aria-label={`Lepas tag ${t.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <button
            onClick={() => setPicking((s) => !s)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-zinc-500 hover:text-zinc-700",
            )}
          >
            <Plus className="h-3 w-3" />
            Tambah tag
          </button>
        )}
      </div>

      {picking && (
        <div className="space-y-1 rounded-lg border border-border bg-white p-2">
          {pickable.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              Semua tag sudah dilampirkan.
            </p>
          ) : (
            pickable.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onAttach(t.id);
                  setPicking(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-zinc-100"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: t.color }}
                />
                {t.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
