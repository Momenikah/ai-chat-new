"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Mail, ShieldCheck, Users, UserCog, type LucideIcon } from "lucide-react";
import type { WorkspaceInvitation, WorkspaceMember } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export function TeamStats({
  members,
  invitations,
}: {
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
}) {
  const stats = useMemo(() => {
    let managers = 0;
    let agents = 0;
    for (const m of members) {
      if (m.role === "OWNER" || m.role === "ADMIN") managers++;
      else if (m.role === "AGENT") agents++;
    }
    return {
      total: members.length,
      managers,
      agents,
      pending: invitations.length,
    };
  }, [members, invitations]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Cell
        index={0}
        icon={Users}
        label="Total anggota"
        value={formatNumber(stats.total)}
        hint="Aktif di workspace"
        accent="bg-zinc-900 text-white"
      />
      <Cell
        index={1}
        icon={ShieldCheck}
        label="Pengelola"
        value={formatNumber(stats.managers)}
        hint="Owner + Admin"
        accent="bg-blue-500 text-white"
      />
      <Cell
        index={2}
        icon={UserCog}
        label="Agent"
        value={formatNumber(stats.agents)}
        hint="Menangani inbox"
        accent="bg-emerald-500 text-white"
      />
      <Cell
        index={3}
        icon={Mail}
        label="Undangan tertunda"
        value={formatNumber(stats.pending)}
        hint={stats.pending > 0 ? "Menunggu pendaftaran" : "Tidak ada"}
        accent={
          stats.pending > 0 ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-700"
        }
      />
    </div>
  );
}

function Cell({
  icon: Icon,
  label,
  value,
  hint,
  accent,
  index,
}: {
  icon: LucideIcon;
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
