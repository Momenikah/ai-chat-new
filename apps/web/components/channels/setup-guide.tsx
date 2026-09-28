"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, ChevronDown } from "lucide-react";
import type { ChannelType } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CHANNEL_META } from "@/components/channels/channel-meta";

const GUIDES: Record<ChannelType, string[]> = {
  whatsapp: [
    "Buka developers.facebook.com → buat App (Business) → tambah produk WhatsApp.",
    "Dari WhatsApp → API Setup, catat Phone Number ID & WhatsApp Business Account ID.",
    "Buat System User dengan permission whatsapp_business_messaging + management untuk token permanen.",
    "Tambah channel di sini, isi credential, salin Callback URL + Verify Token ke Meta → Configuration.",
    "Subscribe field 'messages'. Channel flip ke connected saat webhook pertama tiba.",
  ],
  instagram: [
    "Pastikan akun Instagram Business/Creator ter-link ke Facebook Page.",
    "Tambah produk Instagram di Meta App, minta permission instagram_manage_messages + pages_messaging.",
    "Generate Page Access Token untuk Page tertaut via Graph API Explorer.",
    "Ambil Instagram Business Account ID: GET /<PAGE_ID>?fields=instagram_business_account.",
    "Connect di sini, lalu set Callback URL + Verify Token di Meta → Instagram → Webhooks (field messages).",
  ],
  messenger: [
    "Tambah produk Messenger di Meta App.",
    "Add/Remove Pages → pilih Page → Generate Token, salin Page Access Token.",
    "Set webhook object 'Page' → Callback URL + Verify Token di Meta → Messenger → Webhooks.",
    "Subscribe page ke webhook: POST /<PAGE_ID>/subscribed_apps?subscribed_fields=messages.",
    "Connect di sini dengan Page ID + Page Access Token.",
  ],
  onesender: [
    "Siapkan instance OneSender Anda dan scan QR WhatsApp di dashboard OneSender.",
    "Salin URL instance (mis. https://wa.domainanda.com) dan API key dari menu API.",
    "Tambah channel → WhatsApp OneSender, isi URL instance + API key.",
    "Salin Webhook URL yang muncul ke pengaturan webhook OneSender (pesan masuk).",
    "Kirim pesan tes dari halaman channel. Channel menjadi connected saat kirim/terima berhasil.",
  ],
  starsender: [
    "Login ke app.starsender.online, tambah device lalu scan QR WhatsApp.",
    "Buka menu Device → salin Device API Key (bukan Account API Key).",
    "Tambah channel → WhatsApp StarSender, isi Device API Key.",
    "Salin Webhook URL yang muncul ke pengaturan webhook device di StarSender.",
    "Kirim pesan tes dari halaman channel. Channel menjadi connected saat kirim/terima berhasil.",
  ],
};

const ORDER: ChannelType[] = [
  "whatsapp",
  "instagram",
  "messenger",
  "onesender",
  "starsender",
];

export function ChannelSetupGuide() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ChannelType>("whatsapp");

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-zinc-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <BookOpen className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Panduan setup channel</p>
          <p className="text-xs text-muted-foreground">
            Langkah dapat credential & set webhook di Meta untuk tiap platform.
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
            <div className="space-y-3 p-4">
              <div className="flex gap-1.5">
                {ORDER.map((t) => {
                  const meta = CHANNEL_META[t];
                  const Icon = meta.icon;
                  const on = t === tab;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        on
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
                      )}
                    >
                      <Icon
                        className="h-3 w-3"
                        style={{ color: on ? "#fff" : meta.color }}
                      />
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              <ol className="space-y-2">
                {GUIDES[tab].map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-700">
                      {i + 1}
                    </span>
                    <span className="text-zinc-700">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
