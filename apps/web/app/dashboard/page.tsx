"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Clock, MessagesSquare, Plug, TrendingUp, Users } from "lucide-react";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { StatCard } from "@/components/dashboard/stat-card";
import { MessagesChart } from "@/components/dashboard/messages-chart";
import { ChannelChart } from "@/components/dashboard/channel-chart";
import { RecentConversations } from "@/components/dashboard/recent-conversations";
import {
  HourlyActivityChart,
  ResponseTimeChart,
  StatusAnalytics,
} from "@/components/dashboard/analytics-panels";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { TodaySnapshot } from "@/components/dashboard/today-snapshot";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { LiveActivity } from "@/components/dashboard/live-activity";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

const PERIODS = [
  { label: "7 hari", value: 7 },
  { label: "14 hari", value: 14 },
  { label: "30 hari", value: 30 },
  { label: "90 hari", value: 90 },
];

function formatResponse(seconds: number) {
  if (!seconds) return "0 mnt";
  if (seconds < 3600) return `${Math.round(seconds / 60)} mnt`;
  return `${(seconds / 3600).toFixed(1)} jam`;
}

export default function DashboardPage() {
  const [days, setDays] = useState(7);
  const user = useAuthStore((s) => s.user);
  const currentId = useWorkspaceStore((s) => s.currentId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const current = workspaces.find((w) => w.id === currentId) ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "overview", currentId, days],
    queryFn: () => api.dashboard.overview(currentId as string, days),
    enabled: Boolean(currentId),
  });

  const isEmpty = Boolean(data && data.total_messages === 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SetupChecklist />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Selamat datang, {user?.name?.split(" ")[0] ?? "tim"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Analytics{" "}
            <span className="font-medium text-foreground">
              {current?.name ?? "workspace"}
            </span>{" "}
            untuk {PERIODS.find((p) => p.value === days)?.label} terakhir.
          </p>
        </div>
        <div className="w-full sm:w-36">
          <Select
            aria-label="Pilih rentang analytics"
            value={String(days)}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            {PERIODS.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </Select>
        </div>
      </motion.div>

      {isLoading || !data ? (
        <Skeleton className="h-[112px] rounded-xl" />
      ) : (
        <TodaySnapshot data={data} />
      )}

      {!isLoading && data && isEmpty && <EmptyDashboard />}

      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[124px] rounded-xl" />
          ))}
        </div>
      ) : isEmpty ? null : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            index={0}
            label="Total Kontak"
            value={formatNumber(data.total_contacts)}
            icon={Users}
            delta={data.contacts_delta}
            hint={`${formatNumber(data.new_contacts)} kontak baru`}
          />
          <StatCard
            index={1}
            label="Percakapan Aktif"
            value={formatNumber(data.open_conversations)}
            icon={MessagesSquare}
            delta={data.conversations_delta}
            hint={`${formatNumber(data.pending_conversations)} menunggu follow-up`}
          />
          <StatCard
            index={2}
            label="Total Pesan"
            value={formatNumber(data.total_messages)}
            icon={TrendingUp}
            delta={data.messages_delta}
            hint={`${formatNumber(data.inbound_messages)} masuk / ${formatNumber(data.outbound_messages)} keluar`}
          />
          <StatCard
            index={3}
            label="Rata-rata Respon"
            value={formatResponse(data.avg_response_seconds)}
            icon={Clock}
            hint={`${data.active_agents} agent, ${data.connected_channels} channel aktif`}
          />
        </div>
      )}

      {isLoading || !data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[340px] rounded-xl lg:col-span-2" />
          <Skeleton className="h-[340px] rounded-xl" />
        </div>
      ) : isEmpty ? null : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MessagesChart data={data.messages_series} />
          </div>
          <ChannelChart data={data.channel_breakdown} />
        </div>
      )}

      {isLoading || !data ? (
        <Skeleton className="h-[96px] rounded-xl" />
      ) : isEmpty ? null : (
        <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Resolved hari ini</p>
            <p className="mt-1 text-lg font-semibold">
              {formatNumber(data.resolved_today)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Resolution rate</p>
            <p className="mt-1 text-lg font-semibold">
              {data.resolution_rate.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Agent aktif</p>
            <p className="mt-1 text-lg font-semibold">
              {formatNumber(data.active_agents)}
            </p>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Channel aktif</p>
              <p className="mt-1 text-lg font-semibold">
                {formatNumber(data.connected_channels)}
              </p>
            </div>
            <Plug className="mt-1 h-4 w-4 text-muted-foreground" />
          </div>
        </Card>
      )}

      {isLoading || !data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[360px] rounded-xl" />
          <Skeleton className="h-[360px] rounded-xl lg:col-span-2" />
        </div>
      ) : isEmpty ? null : (
        <div className="grid gap-4 lg:grid-cols-3">
          <StatusAnalytics data={data.status_breakdown} />
          <div className="lg:col-span-2">
            <ResponseTimeChart data={data.response_series} />
          </div>
        </div>
      )}

      {isLoading || !data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[320px] rounded-xl lg:col-span-2" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      ) : isEmpty ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LiveActivity />
          </div>
          <HourlyActivityChart data={data.hourly_activity} />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RecentConversations data={data.recent_conversations} />
            </div>
            <LiveActivity />
          </div>
          <HourlyActivityChart data={data.hourly_activity} />
        </>
      )}
    </div>
  );
}
