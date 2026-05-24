"use client";

import { motion } from "motion/react";
import { Sparkles, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface QuickReplyStarter {
  key: string;
  emoji: string;
  shortcut: string;
  title: string;
  body: string;
}

export const QUICK_REPLY_STARTERS: QuickReplyStarter[] = [
  {
    key: "greet",
    emoji: "👋",
    shortcut: "greet",
    title: "Sapa pelanggan",
    body: "Halo {{name}}! Terima kasih sudah menghubungi kami. Ada yang bisa kami bantu hari ini?",
  },
  {
    key: "thanks",
    emoji: "🙏",
    shortcut: "thanks",
    title: "Ucapan terima kasih",
    body: "Terima kasih banyak {{name}}! Senang bisa membantu. Jangan sungkan menghubungi kami lagi ya.",
  },
  {
    key: "closing",
    emoji: "✅",
    shortcut: "close",
    title: "Penutup percakapan",
    body: "Jika tidak ada pertanyaan lain, percakapan ini akan kami tutup. Terima kasih, semoga harimu menyenangkan! 🙌",
  },
  {
    key: "onhold",
    emoji: "⏳",
    shortcut: "wait",
    title: "Mohon tunggu",
    body: "Mohon tunggu sebentar ya {{name}}, tim kami sedang memeriksa permintaan Anda. Maks 5 menit.",
  },
  {
    key: "oot",
    emoji: "💤",
    shortcut: "oot",
    title: "Di luar jam operasional",
    body: "Saat ini kami di luar jam operasional ({{hours}}). Pesan Anda akan kami balas di hari kerja berikutnya. 🙏",
  },
  {
    key: "promo",
    emoji: "🎉",
    shortcut: "promo",
    title: "Info promo",
    body: "Untuk info promo terbaru, silakan cek katalog kami di {{link}}. Atau ketik *promo* untuk daftar lengkap. 🎁",
  },
  {
    key: "askinfo",
    emoji: "📋",
    shortcut: "info",
    title: "Minta info kontak",
    body: "Boleh saya minta nama lengkap dan nomor pesanan Anda dulu {{name}}? Supaya kami bisa bantu lebih cepat.",
  },
  {
    key: "handoff",
    emoji: "🤝",
    shortcut: "agent",
    title: "Handoff ke agent senior",
    body: "Saya alihkan ke agent senior kami ya {{name}}, supaya bisa membantu lebih detail. Mohon tunggu sebentar.",
  },
];

export function QuickReplyStarterGallery({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (preset: QuickReplyStarter) => void;
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
            Pilih balasan siap pakai atau mulai dari kosong. Anda tetap bisa
            edit shortcut + isi sebelum simpan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              onPick({
                key: "blank",
                emoji: "✨",
                shortcut: "",
                title: "Kosong",
                body: "",
              })
            }
            className="group flex items-start gap-3 rounded-xl border border-dashed border-zinc-300 bg-white p-3 text-left transition-colors hover:border-zinc-500 hover:bg-zinc-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <Zap className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Mulai dari kosong</p>
              <p className="text-xs text-muted-foreground">
                Tulis sendiri shortcut + isi balasan.
              </p>
            </div>
          </button>

          {QUICK_REPLY_STARTERS.map((s, i) => (
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
                  <span className="font-mono text-[10px] text-zinc-500">
                    /{s.shortcut}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
