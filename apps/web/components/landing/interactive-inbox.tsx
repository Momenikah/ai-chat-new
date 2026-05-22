"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
  CheckCheck,
  Instagram,
  MessageCircle,
  Search,
  Sparkles,
} from "lucide-react";

/* ----------------------------- mock data ----------------------------- */

type Channel = "whatsapp" | "instagram" | "messenger";
type From = "customer" | "bot" | "agent";

interface Turn {
  from: From;
  text: string;
  /** ms to wait BEFORE showing this message (after the previous one). */
  delay: number;
  /** for bot/agent turns: how long the typing indicator shows. */
  typing?: number;
}

interface Convo {
  id: string;
  name: string;
  initial: string;
  /** Tailwind class — kept monochrome (zinc-900 / zinc-700 / zinc-500). */
  avatarBg: string;
  channel: Channel;
  preview: string;
  time: string;
  unread?: number;
  thread: Turn[];
}

const CONVERSATIONS: Convo[] = [
  {
    id: "rina",
    name: "Rina Wijaya",
    initial: "R",
    avatarBg: "bg-zinc-900",
    channel: "whatsapp",
    preview: "Halo, masih ada stok ukuran M?",
    time: "now",
    unread: 1,
    thread: [
      { from: "customer", text: "Halo kak, masih ada stok jaket ukuran M warna hitam?", delay: 0 },
      { from: "bot", text: "Halo Rina. Untuk jaket Bomber Hitam, stok M tinggal 3 pcs. Mau saya sisihkan?", delay: 1100, typing: 900 },
      { from: "customer", text: "Boleh, harganya berapa ya?", delay: 1800 },
      { from: "bot", text: "Rp349.000, free ongkir Jabodetabek. Mau order sekarang?", delay: 1100, typing: 700 },
    ],
  },
  {
    id: "agus",
    name: "Agus Pratama",
    initial: "A",
    avatarBg: "bg-zinc-700",
    channel: "instagram",
    preview: "Mau tanya soal katalog terbaru…",
    time: "2m",
    thread: [
      { from: "customer", text: "Bro, katalog Spring 2026 udah keluar belum?", delay: 0 },
      { from: "bot", text: "Sudah. Koleksi Spring 2026 launching minggu ini. Mau saya kirim PDF-nya?", delay: 1300, typing: 800 },
      { from: "customer", text: "Kirim dong", delay: 1500 },
      { from: "agent", text: "Hi Agus, saya Sarah dari tim. PDF sudah saya kirim ya.", delay: 1100, typing: 900 },
    ],
  },
  {
    id: "dewi",
    name: "Dewi Lestari",
    initial: "D",
    avatarBg: "bg-zinc-500",
    channel: "messenger",
    preview: "Pesanan #1042 sudah dikirim?",
    time: "5m",
    thread: [
      { from: "customer", text: "Pesanan #1042 status-nya gimana ya?", delay: 0 },
      { from: "bot", text: "Sebentar Dewi, saya cek dulu.", delay: 800, typing: 600 },
      { from: "bot", text: "Pesanan #1042 sudah dikirim hari ini via JNE. Resi: JNE12345678", delay: 1400, typing: 1000 },
      { from: "customer", text: "Makasih ya!", delay: 1300 },
    ],
  },
];

/* --------------------------- channel chrome -------------------------- */

const CHANNEL_LABEL: Record<Channel, { label: string; Icon: typeof MessageCircle }> = {
  whatsapp: { label: "WhatsApp", Icon: MessageCircle },
  instagram: { label: "Instagram", Icon: Instagram },
  messenger: { label: "Messenger", Icon: MessageCircle },
};

/* ---------------------------- component ------------------------------ */

export function InteractiveInbox() {
  const [activeId, setActiveId] = useState(CONVERSATIONS[0].id);
  const active = CONVERSATIONS.find((c) => c.id === activeId)!;

  const [playedCount, setPlayedCount] = useState(0);
  const [typing, setTyping] = useState<From | null>(null);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    setPlayedCount(0);
    setTyping(null);

    let cursor = 0;
    active.thread.forEach((turn, idx) => {
      if (turn.from !== "customer" && turn.typing) {
        cursor += turn.delay - turn.typing;
        timeouts.current.push(
          setTimeout(() => setTyping(turn.from), Math.max(0, cursor)),
        );
        cursor += turn.typing;
      } else {
        cursor += turn.delay;
      }
      timeouts.current.push(
        setTimeout(() => {
          setTyping(null);
          setPlayedCount(idx + 1);
        }, cursor),
      );
    });

    return () => {
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];
    };
  }, [activeId, active.thread]);

  const visibleTurns = active.thread.slice(0, playedCount);

  return (
    <div className="relative w-full">
      {/* App-window frame — pure B&W */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_24px_80px_-24px_rgba(0,0,0,0.25)]">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          <span className="ml-3 text-xs font-medium text-zinc-500">
            app.aichat.id · Inbox
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-zinc-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-900/40" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-zinc-900" />
            </span>
            Live
          </span>
        </div>

        <div className="grid h-[440px] grid-cols-[220px_1fr]">
          {/* Conversation list */}
          <aside className="flex flex-col border-r border-zinc-200 bg-zinc-50/40">
            <div className="border-b border-zinc-200 px-3 py-2.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <div className="h-7 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-2 text-[11px] leading-7 text-zinc-400">
                  Cari percakapan…
                </div>
              </div>
            </div>
            <ul className="flex-1 overflow-hidden">
              {CONVERSATIONS.map((c) => (
                <ConvoRow
                  key={c.id}
                  convo={c}
                  active={c.id === activeId}
                  onClick={() => setActiveId(c.id)}
                />
              ))}
            </ul>
          </aside>

          {/* Thread */}
          <section className="flex flex-col bg-white">
            {/* Thread header */}
            <header className="flex items-center gap-3 border-b border-zinc-200 px-5 py-3">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white ${active.avatarBg}`}>
                {active.initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">{active.name}</p>
                <ChannelBadge channel={active.channel} />
              </div>
              <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-700">
                <Sparkles className="h-3 w-3" /> AI on
              </span>
            </header>

            {/* Messages — subtle dot grid background */}
            <div className="flex-1 space-y-2 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,_theme(colors.zinc.100)_1px,_transparent_0)] bg-[size:18px_18px] px-5 py-4">
              <AnimatePresence initial={false}>
                {visibleTurns.map((turn, i) => (
                  <Bubble key={`${active.id}-${i}`} turn={turn} isLast={i === visibleTurns.length - 1} />
                ))}
              </AnimatePresence>
              {typing && <TypingIndicator from={typing} />}
            </div>

            {/* Composer (decorative) */}
            <div className="border-t border-zinc-200 bg-white px-5 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                <span className="text-xs text-zinc-400">Tulis balasan…</span>
                <span className="ml-auto text-[10px] text-zinc-400">
                  ⏎ kirim · /qr quick reply
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- sub-pieces ----------------------------- */

function ConvoRow({
  convo,
  active,
  onClick,
}: {
  convo: Convo;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-start gap-2.5 border-b border-zinc-100 px-3 py-2.5 text-left transition-colors ${
          active ? "bg-white" : "hover:bg-white"
        }`}
      >
        <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${convo.avatarBg}`}>
          {convo.initial}
          {convo.unread ? (
            <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-zinc-50 bg-zinc-900 text-[9px] font-bold text-white">
              {convo.unread}
            </span>
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="truncate text-xs font-semibold text-zinc-900">{convo.name}</p>
            <span className="ml-auto text-[10px] text-zinc-400">{convo.time}</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-zinc-500">{convo.preview}</p>
        </div>
      </button>
    </li>
  );
}

function ChannelBadge({ channel }: { channel: Channel }) {
  const { label, Icon } = CHANNEL_LABEL[channel];
  return (
    <span className="mt-0.5 inline-flex items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function Bubble({ turn, isLast }: { turn: Turn; isLast: boolean }) {
  const isCustomer = turn.from === "customer";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}
    >
      <div className={`flex max-w-[78%] flex-col ${isCustomer ? "items-start" : "items-end"} gap-0.5`}>
        <div
          className={`rounded-2xl px-3 py-2 text-sm leading-snug shadow-sm ${
            isCustomer
              ? "rounded-tl-sm bg-zinc-100 text-zinc-900"
              : turn.from === "bot"
                ? "rounded-tr-sm bg-zinc-900 text-white"
                : "rounded-tr-sm bg-zinc-700 text-white"
          }`}
        >
          {turn.text}
        </div>
        {!isCustomer && isLast && (
          <span className="flex items-center gap-1 pr-0.5 text-[10px] text-zinc-400">
            {turn.from === "bot" && <Sparkles className="h-2.5 w-2.5" />}
            {turn.from === "bot" ? "AI · delivered" : "Sarah · delivered"}
            <CheckCheck className="h-3 w-3" />
          </span>
        )}
        {isCustomer && (
          <span className="flex items-center gap-0.5 pl-0.5 text-[10px] text-zinc-400">
            <Check className="h-2.5 w-2.5" />
            read
          </span>
        )}
      </div>
    </motion.div>
  );
}

function TypingIndicator({ from }: { from: From }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex justify-end"
    >
      <div className={`flex items-center gap-1 rounded-2xl rounded-tr-sm px-3 py-2 shadow-sm ${from === "bot" ? "bg-zinc-900" : "bg-zinc-700"}`}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </div>
    </motion.div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="block h-1.5 w-1.5 animate-bounce rounded-full bg-white/80"
      style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
    />
  );
}
