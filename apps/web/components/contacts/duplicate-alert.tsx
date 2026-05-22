"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import type { Contact } from "@aichat/shared";

export function DuplicateAlert({
  duplicates,
}: {
  duplicates: Contact[];
}) {
  const [dismissed, setDismissed] = useState(false);

  if (duplicates.length === 0 || dismissed) return null;

  const preview = duplicates.slice(0, 3);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900">
            {duplicates.length} kemungkinan duplikat terdeteksi
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Kontak berikut memiliki nomor / email yang sama:{" "}
            <span className="font-medium">
              {preview.map((c) => c.name).join(", ")}
            </span>
            {duplicates.length > preview.length &&
              ` +${duplicates.length - preview.length} lainnya`}
            . Buka detail tiap kontak untuk merge.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {preview.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/contacts/${c.id}`}
                className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200 transition-colors hover:bg-amber-100"
              >
                {c.name}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Tutup peringatan"
          className="rounded-md p-1 text-amber-700 hover:bg-amber-100 hover:text-amber-900"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
