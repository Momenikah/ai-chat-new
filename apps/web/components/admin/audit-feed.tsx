"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  CheckCircle2,
  PauseCircle,
  ScrollText,
  ShieldAlert,
  Trash2,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import type { AdminAuditLog } from "@aichat/shared";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

const ACTION_ICON: Record<string, LucideIcon> = {
  workspace_suspended: PauseCircle,
  workspace_unsuspended: CheckCircle2,
  report_resolved: CheckCircle2,
  report_dismissed: ShieldAlert,
  user_impersonated: UserCog,
  workspace_deleted: Trash2,
  user_promoted: UserCog,
  default: ArrowRightLeft,
};

const ACTION_TONE: Record<string, string> = {
  workspace_suspended: "bg-red-500/20 text-red-300",
  workspace_unsuspended: "bg-emerald-500/20 text-emerald-300",
  report_resolved: "bg-emerald-500/20 text-emerald-300",
  report_dismissed: "bg-zinc-500/20 text-zinc-300",
  user_impersonated: "bg-amber-500/20 text-amber-300",
  workspace_deleted: "bg-red-500/20 text-red-300",
  default: "bg-zinc-500/20 text-zinc-300",
};

export function AuditFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit-logs"],
    queryFn: api.admin.auditLogs,
  });

  const logs = data?.audit_logs ?? [];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Aktivitas admin</h2>
        <ScrollText className="h-4 w-4 text-zinc-500" />
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-800" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">Belum ada aktivitas admin.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {logs.slice(0, 8).map((l) => (
            <Row key={l.id} log={l} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ log }: { log: AdminAuditLog }) {
  const Icon = ACTION_ICON[log.action] ?? ACTION_ICON.default;
  const tone = ACTION_TONE[log.action] ?? ACTION_TONE.default;
  return (
    <li className="flex items-start gap-2.5 rounded-lg bg-zinc-950/40 px-3 py-2">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${tone}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-100">
          <span className="font-medium">{log.actor_email}</span>{" "}
          <span className="text-zinc-400">{prettify(log.action)}</span>{" "}
          <span className="font-mono text-xs text-zinc-500">
            {log.target_type}
          </span>
        </p>
        <p className="text-[11px] text-zinc-500">
          {log.target_id.slice(0, 8)}
          {log.ip ? ` · ${log.ip}` : ""}
        </p>
      </div>
      <span className="shrink-0 text-[10px] text-zinc-500">
        {formatRelativeTime(log.created_at)}
      </span>
    </li>
  );
}

function prettify(action: string): string {
  return action.replace(/_/g, " ");
}
