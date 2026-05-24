"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Activity,
  Check,
  CreditCard,
  FileText,
  Loader2,
} from "lucide-react";
import type { SaasPlan } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QrisCheckoutModal } from "@/components/billing/qris-checkout-modal";
import { BillingStats } from "@/components/billing/billing-stats";
import { UsageSummary } from "@/components/billing/usage-summary";
import { PlanComparison } from "@/components/billing/plan-comparison";
import { RecentInvoices } from "@/components/billing/recent-invoices";

function formatIDR(n: number): string {
  if (n === 0) return "Rp0";
  return "Rp" + n.toLocaleString("id-ID");
}

export default function BillingPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const can = useWorkspaceStore((s) => s.can);
  const canManage = can("OWNER");

  const billingQ = useQuery({
    queryKey: ["billing", workspaceId],
    queryFn: () => api.billing.get(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const plansQ = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.billing.plans(),
  });

  const [notice, setNotice] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<SaasPlan | null>(null);

  const changePlan = useMutation({
    mutationFn: (code: string) => api.billing.changePlan(workspaceId as string, code),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["billing", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["usage", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["invoices", workspaceId] });
      if (res.payment) {
        setNotice(
          `Pembayaran ${res.payment.is_placeholder ? "(placeholder) " : ""}berhasil — invoice ${res.invoice?.number ?? ""} dibuat.`,
        );
      } else {
        setNotice("Paket berhasil diubah.");
      }
      setTimeout(() => setNotice(null), 4000);
    },
  });

  const currentPlan = billingQ.data?.plan;
  const plans = plansQ.data?.plans ?? [];
  const err = changePlan.error instanceof ApiException ? changePlan.error.message : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-4xl space-y-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
          <CreditCard className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Kelola paket langganan workspace Anda.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/billing/usage">
            <Button variant="outline" size="sm">
              <Activity className="h-4 w-4" /> Usage
            </Button>
          </Link>
          <Link href="/dashboard/billing/invoices">
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4" /> Invoice
            </Button>
          </Link>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <Check className="h-4 w-4" /> {notice}
        </div>
      )}

      {/* Stats + current subscription */}
      {billingQ.isLoading ? (
        <Skeleton className="h-[88px] rounded-xl" />
      ) : billingQ.data && workspaceId ? (
        <BillingStats billing={billingQ.data} workspaceId={workspaceId} />
      ) : null}

      {err && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>
      )}

      {/* Usage + invoices inline */}
      {workspaceId && (
        <div className="grid gap-4 lg:grid-cols-2">
          <UsageSummary workspaceId={workspaceId} />
          <RecentInvoices workspaceId={workspaceId} />
        </div>
      )}

      {/* Plan options */}
      <div>
        <h2 className="mb-3 font-semibold">Pilih paket</h2>
        {plansQ.isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <PlanOption
                key={plan.id}
                plan={plan}
                current={currentPlan?.code === plan.code}
                canManage={canManage}
                pending={changePlan.isPending && changePlan.variables === plan.code}
                onChoose={() => {
                  // Paid plans go through the QRIS payment + WhatsApp
                  // confirmation flow; the free plan switches instantly.
                  if (plan.price_idr > 0) {
                    setCheckoutPlan(plan);
                  } else {
                    changePlan.mutate(plan.code);
                  }
                }}
              />
            ))}
          </div>
        )}
        {!canManage && (
          <p className="mt-3 text-xs text-muted-foreground">
            Hanya pemilik workspace yang dapat mengubah paket.
          </p>
        )}
      </div>

      {!plansQ.isLoading && plans.length > 0 && (
        <PlanComparison plans={plans} currentCode={currentPlan?.code} />
      )}

      <QrisCheckoutModal
        plan={checkoutPlan}
        open={checkoutPlan !== null}
        onClose={() => setCheckoutPlan(null)}
      />
    </motion.div>
  );
}

function PlanOption({
  plan,
  current,
  canManage,
  pending,
  onChoose,
}: {
  plan: SaasPlan;
  current: boolean;
  canManage: boolean;
  pending: boolean;
  onChoose: () => void;
}) {
  return (
    <Card className={current ? "border-zinc-900 ring-1 ring-zinc-900" : ""}>
      <CardHeader>
        <CardTitle className="text-base">{plan.name}</CardTitle>
        <CardDescription>
          {formatIDR(plan.price_idr)}
          {plan.price_idr > 0 ? "/bulan" : " selamanya"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {current ? (
          <Button disabled className="w-full" variant="outline">
            Paket aktif
          </Button>
        ) : (
          <Button
            className="w-full"
            disabled={!canManage || pending}
            onClick={onChoose}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Pilih paket
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
