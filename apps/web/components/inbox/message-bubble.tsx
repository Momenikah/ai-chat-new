"use client";

import { motion } from "motion/react";
import { Check, CheckCheck, Clock, FileText } from "lucide-react";
import type { Message } from "@aichat/shared";
import { cn } from "@/lib/utils";

export function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === "outbound";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn("flex w-full", outbound ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
          outbound
            ? "rounded-br-md bg-zinc-900 text-white"
            : "rounded-bl-md border border-border bg-white text-zinc-900",
        )}
      >
        {message.kind !== "text" && (
          <div
            className={cn(
              "mb-1 flex items-center gap-1.5 text-xs",
              outbound ? "text-zinc-300" : "text-muted-foreground",
            )}
          >
            <FileText className="h-3 w-3" />
            <span className="capitalize">{message.kind}</span>
          </div>
        )}

        <p className="whitespace-pre-wrap break-words">
          {message.body ?? <em className="opacity-60">(tanpa isi)</em>}
        </p>

        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[10px]",
            outbound ? "text-zinc-400" : "text-muted-foreground",
          )}
        >
          <span>{formatTime(message.created_at)}</span>
          {outbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </motion.div>
  );
}

function StatusIcon({ status }: { status: Message["status"] }) {
  switch (status) {
    case "queued":
      return <Clock className="h-3 w-3" />;
    case "sent":
      return <Check className="h-3 w-3" />;
    case "delivered":
      return <CheckCheck className="h-3 w-3" />;
    case "read":
      return <CheckCheck className="h-3 w-3 text-sky-300" />;
    case "failed":
      return <span className="text-red-300">!</span>;
    default:
      return null;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
