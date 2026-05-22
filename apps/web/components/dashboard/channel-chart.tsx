"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DashboardOverview } from "@aichat/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const COLORS = ["#18181b", "#52525b", "#a1a1aa", "#d4d4d8"];

export function ChannelChart({
  data,
}: {
  data: DashboardOverview["channel_breakdown"];
}) {
  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribusi Channel</CardTitle>
        <CardDescription>Percakapan per kanal</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="h-[160px] w-[160px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="channel"
                  innerRadius={48}
                  outerRadius={76}
                  paddingAngle={3}
                  stroke="none"
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e4e4e7",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex-1 space-y-2.5">
            {data.map((d, i) => (
              <li
                key={d.channel}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  {d.channel}
                </span>
                <span className="font-medium text-muted-foreground">
                  {total > 0 ? Math.round((d.value / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
