"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Check, MessagesSquare } from "lucide-react";
import type { SaasPlan } from "@aichat/shared";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function formatIDR(n: number): string {
  if (n === 0) return "Rp0";
  return "Rp" + n.toLocaleString("id-ID");
}

export default function PricingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.billing.plans(),
  });
  const plans = data?.plans ?? [];

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950">
              <MessagesSquare className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold tracking-tight">AI Chat</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Masuk
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Daftar gratis</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-12 text-center"
        >
          <h1 className="text-3xl font-semibold tracking-tight">
            Harga yang sederhana & transparan
          </h1>
          <p className="mt-3 text-muted-foreground">
            Mulai gratis, upgrade kapan saja. Tanpa biaya tersembunyi.
          </p>
        </motion.div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-96 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan, i) => (
              <PlanCard key={plan.id} plan={plan} highlighted={i === plans.length - 1} />
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Pembayaran diproses via Midtrans (placeholder pada mode demo).
        </p>
      </main>
    </div>
  );
}

function PlanCard({ plan, highlighted }: { plan: SaasPlan; highlighted: boolean }) {
  const isFree = plan.price_idr === 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col rounded-2xl border bg-white p-6 ${
        highlighted ? "border-zinc-900 shadow-lg ring-1 ring-zinc-900" : "border-zinc-200"
      }`}
    >
      {highlighted && (
        <span className="mb-3 inline-flex w-fit rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
          Paling lengkap
        </span>
      )}
      <h2 className="text-lg font-semibold">{plan.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight">
          {formatIDR(plan.price_idr)}
        </span>
        <span className="text-sm text-muted-foreground">
          /{plan.billing_period === "forever" ? "selamanya" : "bulan"}
        </span>
      </div>

      <ul className="mt-6 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link href="/dashboard/billing" className="mt-6">
        <Button className="w-full" variant={highlighted ? "default" : "outline"}>
          {isFree ? "Mulai gratis" : `Pilih ${plan.name}`}
        </Button>
      </Link>
    </motion.div>
  );
}
