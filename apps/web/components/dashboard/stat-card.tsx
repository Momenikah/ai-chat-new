"use client";

import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: number;
  hint?: string;
  index?: number;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  hint,
  index = 0,
}: StatCardProps) {
  const positive = (delta ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
      whileHover={{ y: -2 }}
    >
      <Card className="p-5 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
            <Icon className="h-4 w-4 text-zinc-700" />
          </div>
        </div>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-2xl font-semibold tracking-tight">
            {value}
          </span>
          {delta !== undefined && (
            <span
              className={cn(
                "mb-1 inline-flex items-center gap-0.5 text-xs font-medium",
                positive ? "text-emerald-600" : "text-red-600",
              )}
            >
              {positive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(delta)}%
            </span>
          )}
        </div>
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </Card>
    </motion.div>
  );
}
