"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  Bot,
  MessagesSquare,
  Phone,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface NextStep {
  icon: LucideIcon;
  title: string;
  desc: string;
  cta: string;
  href: string;
}

const STEPS: NextStep[] = [
  {
    icon: Phone,
    title: "Hubungkan channel",
    desc: "Tambahkan WhatsApp, Instagram, atau Messenger agar inbox mulai menerima pesan.",
    cta: "Buka channel",
    href: "/dashboard/channels",
  },
  {
    icon: UsersRound,
    title: "Undang tim",
    desc: "Tambah admin atau agent supaya percakapan bisa di-assign saat ramai.",
    cta: "Kelola tim",
    href: "/dashboard/settings/team",
  },
  {
    icon: Bot,
    title: "Setel AI Chatbot",
    desc: "Aktifkan auto-reply dan setujui prompt untuk membalas tanpa human di luar jam kerja.",
    cta: "Atur AI",
    href: "/dashboard/ai-agent",
  },
];

export function EmptyDashboard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden">
        <div className="border-b border-border bg-gradient-to-br from-zinc-50 to-white p-6">
          <div className="flex items-start gap-4">
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, type: "spring" }}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white"
            >
              <MessagesSquare className="h-6 w-6" />
            </motion.span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  Belum ada pesan di workspace ini
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                  <Sparkles className="h-3 w-3" /> baru
                </span>
              </div>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Analytics akan muncul otomatis begitu pesan pertama masuk.
                Sementara itu, selesaikan tiga langkah berikut agar workspace
                siap menerima percakapan.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/dashboard/onboarding">
                    Jalankan wizard <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard/channels">Hubungkan channel</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <ul className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i + 0.1, duration: 0.25 }}
                className="p-5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-3 text-sm font-medium">{s.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
                <Link
                  href={s.href}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-900 hover:underline"
                >
                  {s.cta} <ArrowRight className="h-3 w-3" />
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </Card>
    </motion.div>
  );
}
