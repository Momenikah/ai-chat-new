"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { FilePlus, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STARTER_TEMPLATES } from "@/components/templates/template-starters";

export function StarterGallery({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Mulai dari template
          </DialogTitle>
          <DialogDescription>
            Pilih preset siap pakai atau mulai dari kosong. Anda tetap bisa
            edit semua field sebelum submit ke Meta.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => go("/dashboard/templates/new")}
            className="group flex items-start gap-3 rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-left transition-colors hover:border-zinc-500 hover:bg-zinc-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <FilePlus className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Mulai dari kosong</p>
              <p className="text-xs text-muted-foreground">
                Editor blank, isi sendiri.
              </p>
            </div>
          </button>

          {STARTER_TEMPLATES.map((s, i) => (
            <motion.button
              key={s.key}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * (i + 1) }}
              onClick={() => go(`/dashboard/templates/new?starter=${s.key}`)}
              className="group flex items-start gap-3 rounded-xl border border-border bg-white p-4 text-left transition-shadow hover:shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg">
                {s.emoji}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{s.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {s.description}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-400">
                  {s.values.category} · {s.values.variables.length} variabel
                  {s.values.buttons.length > 0 &&
                    ` · ${s.values.buttons.length} button`}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
