"use client";

import { motion } from "motion/react";
import { Sparkles, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KIND_META } from "@/components/interactive/interactive-shared";
import {
  INTERACTIVE_STARTERS,
  type InteractiveStarter,
} from "@/components/interactive/interactive-starters";

export function InteractiveStarterGallery({
  open,
  onOpenChange,
  onPick,
  onBlank,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (preset: InteractiveStarter) => void;
  onBlank: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Mulai dari preset
          </DialogTitle>
          <DialogDescription>
            Pilih contoh siap pakai atau bangun dari kosong. Semua field tetap
            bisa diedit di builder.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onBlank}
            className="group flex items-start gap-3 rounded-xl border border-dashed border-zinc-300 bg-white p-3 text-left transition-colors hover:border-zinc-500 hover:bg-zinc-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <Wand2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Mulai dari kosong</p>
              <p className="text-xs text-muted-foreground">
                Bangun sendiri dari builder.
              </p>
            </div>
          </button>

          {INTERACTIVE_STARTERS.map((s, i) => {
            const Icon = KIND_META[s.kind].icon;
            return (
              <motion.button
                key={s.key}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * (i + 1) }}
                onClick={() => onPick(s)}
                className="group flex items-start gap-3 rounded-xl border border-border bg-white p-3 text-left transition-shadow hover:shadow-sm"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg">
                  {s.emoji}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium">{s.title}</p>
                    <Icon className="h-3 w-3 shrink-0 text-zinc-400" />
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {s.description}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-400">
                    {KIND_META[s.kind].label}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
