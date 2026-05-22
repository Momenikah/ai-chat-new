"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardOverview } from "@aichat/shared";
import { formatNumber } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATUS_COLORS: Record<string, string> = {
  open: "#059669",
  pending: "#d97706",
  resolved: "#2563eb",
  spam: "#dc2626",
};

function formatMinutes(seconds: number) {
  if (!seconds) return "0m";
  return `${Math.max(1, Math.round(seconds / 60))}m`;
}

export function StatusAnalytics({
  data,
}: {
  data: DashboardOverview["status_breakdown"];
}) {
  const total = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Percakapan</CardTitle>
        <CardDescription>Komposisi semua percakapan workspace</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[190px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -16 }}>
              <CartesianGrid vertical={false} stroke="#f4f4f5" />
              <XAxis
                dataKey="status"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "#71717a" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "#71717a" }}
                width={38}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e4e4e7",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((item) => (
                  <Cell
                    key={item.status}
                    fill={STATUS_COLORS[item.status] ?? "#52525b"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {data.map((item) => (
            <div
              key={item.status}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="capitalize text-muted-foreground">
                  {item.status}
                </span>
                <span className="font-medium">{formatNumber(item.value)}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {total > 0 ? Math.round((item.value / total) * 100) : 0}%
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ResponseTimeChart({
  data,
}: {
  data: DashboardOverview["response_series"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kecepatan Respon</CardTitle>
        <CardDescription>Rata-rata balasan pertama per hari</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke="#f4f4f5" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "#71717a" }}
              />
              <YAxis
                tickFormatter={formatMinutes}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "#71717a" }}
                width={44}
              />
              <Tooltip
                formatter={(value) => formatMinutes(Number(value))}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e4e4e7",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="seconds"
                name="Respon"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function HourlyActivityChart({
  data,
}: {
  data: DashboardOverview["hourly_activity"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Jam Tersibuk</CardTitle>
        <CardDescription>Volume pesan berdasarkan jam</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke="#f4f4f5" />
              <XAxis
                dataKey="hour"
                interval={2}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "#71717a" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "#71717a" }}
                width={38}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e4e4e7",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="total" name="Pesan" fill="#0f766e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
