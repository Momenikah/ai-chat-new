"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ShieldQuestion } from "lucide-react";
import type { MemberRole } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ROLES: {
  role: MemberRole;
  variant: "default" | "secondary" | "outline";
  summary: string;
  can: string[];
}[] = [
  {
    role: "OWNER",
    variant: "default",
    summary: "Akses penuh, pemilik workspace.",
    can: [
      "Semua kemampuan ADMIN",
      "Ganti paket & kelola billing",
      "Hapus workspace",
    ],
  },
  {
    role: "ADMIN",
    variant: "secondary",
    summary: "Mengelola operasional workspace.",
    can: [
      "Kelola channel, tim & undangan",
      "Broadcast, template, AI chatbot & knowledge",
      "API key, webhook & pengaturan workspace",
    ],
  },
  {
    role: "AGENT",
    variant: "outline",
    summary: "Menangani percakapan pelanggan.",
    can: [
      "Inbox: balas, assign, catatan, status",
      "Kelola kontak & quick reply",
      "Tidak bisa ubah pengaturan/channel",
    ],
  },
  {
    role: "VIEWER",
    variant: "outline",
    summary: "Akses baca-saja.",
    can: [
      "Lihat dashboard, kontak & percakapan",
      "Tidak bisa mengirim pesan",
      "Tidak bisa mengubah data",
    ],
  },
];

export function RoleReference() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-zinc-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <ShieldQuestion className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Apa beda tiap role?</p>
          <p className="text-xs text-muted-foreground">
            Panduan izin OWNER / ADMIN / AGENT / VIEWER sebelum mengundang.
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {ROLES.map((r) => (
                <div
                  key={r.role}
                  className="rounded-lg border border-border bg-zinc-50/40 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={r.variant}>{r.role}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {r.summary}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {r.can.map((c) => (
                      <li
                        key={c}
                        className="flex items-start gap-1.5 text-xs text-zinc-700"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
