"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileText } from "lucide-react";
import type { Invoice, InvoiceStatus } from "@aichat/shared";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function formatIDR(n: number): string {
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

export function RecentInvoices({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["invoices", workspaceId],
    queryFn: () => api.billing.invoices(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const invoices = (data?.invoices ?? []).slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Invoice terbaru</CardTitle>
            <CardDescription>5 tagihan terakhir workspace.</CardDescription>
          </div>
          <Link
            href="/dashboard/billing/invoices"
            className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900"
          >
            Semua <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center">
            <FileText className="mx-auto h-6 w-6 text-zinc-400" />
            <p className="mt-2 text-sm font-medium">Belum ada invoice</p>
            <p className="text-xs text-muted-foreground">
              Muncul setelah berlangganan paket berbayar.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {invoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const badge = STATUS_BADGE[invoice.status];
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
        <FileText className="h-4 w-4 text-zinc-600" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-mono text-sm font-medium">
            {invoice.number}
          </p>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date(invoice.created_at).toLocaleDateString("id-ID")}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold">
        {formatIDR(invoice.amount_idr)}
      </span>
    </li>
  );
}
