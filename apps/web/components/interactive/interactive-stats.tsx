"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { List, MousePointerClick, Sparkles, Layers } from "lucide-react";
import type { InteractiveMessage } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export function InteractiveStats({
  items,
}: {
  items: InteractiveMessage[];
}) {
  const counts = useMemo(() => {
    let reply = 0;
    let list = 0;
    let carousel = 0;
    for (const i of items) {
      if (i.kind === "reply_buttons") reply++;
      else if (i.kind === "list") list++;
      else if (i.kind === "carousel") carousel++;
    }
    return { reply, list, carousel };
  }, [items]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Cell
        index={0}
        icon={Layers}
        label="Total interactive"
        value={formatNumber(items.length)}
        accent="bg-zinc-900 text-white"
      />
      <Cell
        index={1}
        icon={MousePointerClick}
        label="Reply buttons"
        value={formatNumber(counts.reply)}
        accent="bg-emerald-500 text-white"
      />
      <Cell
        index={2}
        icon={List}
        label="List selector"
        value={formatNumber(counts.list)}
        accent="bg-blue-500 text-white"
      />
      <Cell
        index={3}
        icon={Sparkles}
        label="Media carousel"
        value={formatNumber(counts.carousel)}
        accent="bg-violet-500 text-white"
      />
    </div>
  );
}

function Cell({
  icon: Icon,
  label,
  value,
  accent,
  index,
}: {
  icon: typeof List;
  label: string;
  value: string;
  accent: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
    >
      <Card className="flex items-center gap-3 p-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tracking-tight">{value}</p>
        </div>
      </Card>
    </motion.div>
  );
}
