"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, FileText } from "lucide-react";
import type { Invoice, InvoiceStatus } from "@aichat/shared";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function formatIDR(n: number): string {
  if (n === 0) return "Rp0";
  return "Rp" + n.toLocaleString("id-ID");
}

const STATUS_BADGE: Record<
  InvoiceStatus,
  { variant: "success" | "warning" | "secondary" | "destructive"; label: string }
> = {
  paid: { variant: "success", label: "Lunas" },
  open: { variant: "warning", label: "Menunggu" },
  draft: { variant: "secondary", label: "Draft" },
  void: { variant: "destructive", label: "Batal" },
};

export default function InvoicesPage() {
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const { data, isLoading } = useQuery({
    queryKey: ["invoices", workspaceId],
    queryFn: () => api.billing.invoices(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const invoices = data?.invoices ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <div className="flex items-center gap-3">
        <Link href="/dashboard/billing">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Invoice</h1>
          <p className="text-sm text-muted-foreground">
            Riwayat tagihan workspace (placeholder pembayaran).
          </p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : invoices.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <FileText className="h-6 w-6 text-zinc-500" />
          </div>
          <p className="font-medium">Belum ada invoice</p>
          <p className="text-sm text-muted-foreground">
            Invoice muncul setelah Anda berlangganan paket berbayar.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {invoices.map((inv) => (
            <InvoiceRow key={inv.id} invoice={inv} />
          ))}
        </ul>
      )}
    </motion.div>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const badge = STATUS_BADGE[invoice.status];
  return (
    <li>
      <Card className="flex items-center gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm font-medium">{invoice.number}</p>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date(invoice.created_at).toLocaleDateString("id-ID")}
            {invoice.payment_provider ? ` • ${invoice.payment_provider}` : ""}
            {invoice.payment_ref ? ` • ${invoice.payment_ref}` : ""}
          </p>
        </div>
        <span className="text-sm font-semibold">{formatIDR(invoice.amount_idr)}</span>
      </Card>
    </li>
  );
}
