"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  CalendarClock,
  CreditCard,
  Receipt,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { BillingSummary } from "@aichat/shared";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";

function formatIDR(n: number): string {
  return "Rp" + n.toLocaleString("id-ID");
}

const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  trial: "Trial",
  past_due: "Jatuh tempo",
  cancelled: "Dibatalkan",
};

export function BillingStats({
  billing,
  workspaceId,
}: {
  billing: BillingSummary;
  workspaceId: string;
}) {
  const invoicesQ = useQuery({
    queryKey: ["invoices", workspaceId],
    queryFn: () => api.billing.invoices(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const totalPaid = useMemo(
    () =>
      (invoicesQ.data?.invoices ?? [])
        .filter((i) => i.status === "paid")
        .reduce((s, i) => s + i.amount_idr, 0),
    [invoicesQ.data],
  );

  const { subscription: sub, plan } = billing;

  const daysLeft = useMemo(() => {
    if (!sub.current_period_end) return null;
    const diff =
      new Date(sub.current_period_end).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  }, [sub.current_period_end]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Cell
        index={0}
        icon={Sparkles}
        label="Paket aktif"
        value={plan.name}
        hint={
          plan.price_idr > 0
            ? `${formatIDR(plan.price_idr)}/bln`
            : "Gratis selamanya"
        }
        accent="bg-zinc-900 text-white"
      />
      <Cell
        index={1}
        icon={CreditCard}
        label="Status langganan"
        value={STATUS_LABEL[sub.status] ?? sub.status}
        hint={sub.cancel_at_period_end ? "Berhenti di akhir periode" : "Berjalan"}
        accent={
          sub.status === "active"
            ? "bg-emerald-500 text-white"
            : sub.status === "trial"
              ? "bg-amber-500 text-white"
              : sub.status === "past_due"
                ? "bg-red-500 text-white"
                : "bg-zinc-100 text-zinc-700"
        }
      />
      <Cell
        index={2}
        icon={CalendarClock}
        label="Periode berakhir"
        value={daysLeft === null ? "—" : `${daysLeft} hari`}
        hint={
          sub.current_period_end
            ? new Date(sub.current_period_end).toLocaleDateString("id-ID")
            : "Tanpa batas"
        }
        accent="bg-blue-500 text-white"
      />
      <Cell
        index={3}
        icon={Receipt}
        label="Total dibayar"
        value={invoicesQ.isLoading ? "…" : formatIDR(totalPaid)}
        hint="Invoice lunas kumulatif"
        accent="bg-violet-500 text-white"
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
          <p className="mt-0.5 truncate text-xl font-semibold tracking-tight">
            {value}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      </Card>
    </motion.div>
  );
}
