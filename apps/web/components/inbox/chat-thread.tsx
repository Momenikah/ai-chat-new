"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import type { Message } from "@aichat/shared";
import { MessageBubble } from "./message-bubble";

export function ChatThread({
  messages,
  typing,
}: {
  messages: Message[];
  typing: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typing]);

  return (
    <div className="flex-1 space-y-2 overflow-y-auto bg-zinc-50/40 px-4 py-4">
      {messages.map((m, i) => (
        <div key={m.id}>
          {showDateDivider(messages, i) && (
            <p className="my-2 text-center text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              {formatDay(m.created_at)}
            </p>
          )}
          <MessageBubble message={m} />
        </div>
      ))}

      {typing && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
        >
          <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-white px-3 py-2 shadow-sm">
            <Dot delay={0} />
            <Dot delay={0.15} />
            <Dot delay={0.3} />
          </div>
        </motion.div>
      )}

      <div ref={endRef} />
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-zinc-400"
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1, repeat: Infinity, delay }}
    />
  );
}

function showDateDivider(list: Message[], i: number): boolean {
  if (i === 0) return true;
  const a = new Date(list[i - 1].created_at);
  const b = new Date(list[i].created_at);
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });
}
