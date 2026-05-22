"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  ArrowRight,
  Bot,
  Check,
  Palette,
  Phone,
  Rocket,
  UsersRound,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "aichat_dashboard_setup_dismissed_";

interface ChecklistItem {
  key: string;
  label: string;
  icon: typeof Rocket;
  done: boolean;
  href: string;
}

export function SetupChecklist() {
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const workspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.currentId),
  );
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!workspaceId || typeof window === "undefined") return;
    setDismissed(
      window.localStorage.getItem(DISMISS_KEY + workspaceId) === "1",
    );
  }, [workspaceId]);

  const channelsQ = useQuery({
    queryKey: ["channels", workspaceId],
    queryFn: () => api.channels.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const membersQ = useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => api.members.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const aiQ = useQuery({
    queryKey: ["ai-agent", workspaceId],
    queryFn: () => api.aiAgent.get(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const items: ChecklistItem[] = useMemo(() => {
    const brandingDone = Boolean(
      workspace &&
        workspace.name &&
        workspace.brand_color &&
        workspace.brand_color !== "#000000",
    );
    const channels = channelsQ.data?.channels ?? [];
    const channelDone = channels.some((c) => c.status === "connected");
    const membersCount = membersQ.data?.members.length ?? 0;
    const teamDone = membersCount > 1;
    const agent = aiQ.data;
    const aiDone = Boolean(agent && agent.enabled && agent.prompt_approved);

    return [
      {
        key: "branding",
        label: "Branding workspace",
        icon: Palette,
        done: brandingDone,
        href: "/dashboard/settings",
      },
      {
        key: "channel",
        label: "Hubungkan minimal 1 channel",
        icon: Phone,
        done: channelDone,
        href: "/dashboard/channels",
      },
      {
        key: "team",
        label: "Undang anggota tim",
        icon: UsersRound,
        done: teamDone,
        href: "/dashboard/settings/team",
      },
      {
        key: "ai",
        label: "Aktifkan & setujui AI Chatbot",
        icon: Bot,
        done: aiDone,
        href: "/dashboard/ai-agent",
      },
    ];
  }, [workspace, channelsQ.data, membersQ.data, aiQ.data]);

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const allDone = completed === total;

  if (dismissed || allDone || !workspaceId) return null;

  const percent = Math.round((completed / total) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <Rocket className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  Selesaikan setup workspace
                </p>
                <p className="text-xs text-muted-foreground">
                  {completed}/{total} selesai · siapkan inbox agar siap menerima
                  pesan pertama.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href="/dashboard/onboarding"
                  className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
                >
                  Buka wizard <ArrowRight className="h-3 w-3" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem(
                        DISMISS_KEY + workspaceId,
                        "1",
                      );
                    }
                    setDismissed(true);
                  }}
                  aria-label="Tutup"
                  className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="h-full rounded-full bg-emerald-500"
              />
            </div>

            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs transition-colors",
                        item.done
                          ? "bg-emerald-50/40 text-zinc-700 hover:bg-emerald-50"
                          : "bg-white text-zinc-700 hover:bg-zinc-50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                          item.done
                            ? "bg-emerald-500 text-white"
                            : "border border-zinc-300 bg-white text-zinc-400",
                        )}
                      >
                        {item.done ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Icon className="h-3 w-3" />
                        )}
                      </span>
                      <span
                        className={cn(
                          "flex-1 truncate",
                          item.done && "line-through opacity-70",
                        )}
                      >
                        {item.label}
                      </span>
                      <ArrowRight className="h-3 w-3 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
