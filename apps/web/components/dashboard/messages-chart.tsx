"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardOverview } from "@aichat/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function MessagesChart({
  data,
}: {
  data: DashboardOverview["messages_series"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Volume Pesan</CardTitle>
        <CardDescription>
          Pesan masuk vs keluar dalam 7 hari terakhir
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="inbound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#18181b" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#18181b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="outbound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a1a1aa" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#a1a1aa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f4f4f5"
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "#a1a1aa" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "#a1a1aa" }}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e4e4e7",
                  fontSize: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                }}
              />
              <Area
                type="monotone"
                dataKey="inbound"
                name="Masuk"
                stroke="#18181b"
                strokeWidth={2}
                fill="url(#inbound)"
              />
              <Area
                type="monotone"
                dataKey="outbound"
                name="Keluar"
                stroke="#a1a1aa"
                strokeWidth={2}
                fill="url(#outbound)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
