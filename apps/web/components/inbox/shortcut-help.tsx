"use client";

import { AnimatePresence, motion } from "motion/react";
import { Keyboard, X } from "lucide-react";
import { SHORTCUT_HELP } from "@/hooks/use-inbox-shortcuts";

export function ShortcutHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
                  <Keyboard className="h-4 w-4" />
                </span>
                <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
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

            <ul className="mt-4 divide-y divide-border">
              {SHORTCUT_HELP.map((s) => (
                <li
                  key={s.keys}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="text-sm text-zinc-700">{s.label}</span>
                  <kbd className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700">
                    {s.keys}
                  </kbd>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs text-muted-foreground">
              Shortcut tidak aktif saat fokus berada di kolom input / komposer
              (kecuali Esc).
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
