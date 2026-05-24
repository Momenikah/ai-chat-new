"use client";

import { motion } from "motion/react";
import { Crown, Wallet } from "lucide-react";
import type { PlatformOverview } from "@aichat/shared";

function formatIDR(n: number): string {
  if (!n) return "Rp0";
  return "Rp" + n.toLocaleString("id-ID");
}

export function RevenueHero({ data }: { data: PlatformOverview }) {
  const paidPlans = data.plan_breakdown.filter(
    (p) => p.plan_code !== "FREE" && p.plan_code !== "free",
  );
  const paidCount = paidPlans.reduce((s, p) => s + p.count, 0);
  const totalSubs = data.plan_breakdown.reduce((s, p) => s + p.count, 0);
  const paidPct =
    totalSubs > 0 ? Math.round((paidCount / totalSubs) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-zinc-900 to-zinc-900 p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-400">
            <Wallet className="h-3.5 w-3.5" /> Revenue (paid invoices)
          </div>
          <p className="mt-2 text-4xl font-bold tracking-tight text-white">
            {formatIDR(data.revenue_idr)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Akumulasi pembayaran lunas seluruh workspace.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
          <Crown className="h-5 w-5 text-amber-400" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              Paid plans
            </p>
            <p className="text-lg font-semibold text-white">
              {paidCount}
              <span className="ml-1 text-xs font-normal text-zinc-400">
                / {totalSubs} subs ({paidPct}%)
              </span>
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
