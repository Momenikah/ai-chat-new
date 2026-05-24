"use client";

import { motion } from "motion/react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Gauge,
  Plug,
  Power,
} from "lucide-react";
import type { AIAgent, Channel } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";

export function AgentStatusBanner({
  agent,
  channels,
  knowledgeCount,
}: {
  agent: AIAgent;
  channels: Channel[];
  knowledgeCount: number | null;
}) {
  // Reasons the bot is NOT replying (all must pass to be live).
  const reasons: string[] = [];
  if (!agent.enabled) reasons.push("bot dimatikan (toggle Aktifkan bot)");
  if (!agent.prompt_approved) reasons.push("prompt belum disetujui");

  const enabledChannels = agent.enabled_channel_ids ?? [];
  const connectedCount = channels.filter(
    (c) => c.status === "connected",
  ).length;
  if (connectedCount === 0)
    reasons.push("belum ada channel yang terhubung");

  const live = reasons.length === 0;
  const channelScope =
    enabledChannels.length === 0
      ? "semua channel"
      : `${enabledChannels.length} channel`;

  return (
    <div className="space-y-3">
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card
          className={cn(
            "flex items-start gap-3 p-4",
            live
              ? "border-emerald-200 bg-emerald-50/60"
              : "border-amber-200 bg-amber-50/60",
          )}
        >
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white",
              live ? "bg-emerald-500" : "bg-amber-500",
            )}
          >
            {live ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-sm font-semibold",
                live ? "text-emerald-900" : "text-amber-900",
              )}
            >
              {live
                ? `Bot aktif & membalas di ${channelScope}`
                : "Bot saat ini tidak membalas otomatis"}
            </p>
            <p
              className={cn(
                "mt-0.5 text-xs",
                live ? "text-emerald-800" : "text-amber-800",
              )}
            >
              {live
                ? "Semua syarat terpenuhi: bot aktif, prompt disetujui, dan ada channel terhubung."
                : `Perlu diperbaiki: ${reasons.join(" · ")}.`}
            </p>
          </div>
        </Card>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCell
          index={0}
          icon={Power}
          label="Status bot"
          value={live ? "Live" : "Diam"}
          hint={agent.enabled ? "toggle aktif" : "toggle mati"}
          accent={live ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"}
        />
        <StatCell
          index={1}
          icon={Gauge}
          label="Confidence threshold"
          value={agent.confidence_threshold.toFixed(2)}
          hint={agent.handoff_enabled ? "handoff aktif" : "handoff mati"}
          accent="bg-zinc-900 text-white"
        />
        <StatCell
          index={2}
          icon={Plug}
          label="Channel auto-reply"
          value={
            enabledChannels.length === 0
              ? "Semua"
              : formatNumber(enabledChannels.length)
          }
          hint={`${connectedCount} channel terhubung`}
          accent="bg-blue-500 text-white"
        />
        <StatCell
          index={3}
          icon={BookOpen}
          label="Knowledge docs"
          value={knowledgeCount === null ? "—" : formatNumber(knowledgeCount)}
          hint="Sumber jawaban RAG"
          accent="bg-violet-500 text-white"
        />
      </div>
    </div>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
  hint,
  accent,
  index,
}: {
  icon: typeof Power;
  label: string;
  value: string;
  hint: string;
  accent: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
    >
      <Card className="flex items-start gap-3 p-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight">{value}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      </Card>
    </motion.div>
  );
}
