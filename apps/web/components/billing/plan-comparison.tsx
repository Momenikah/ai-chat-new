"use client";

import { Check, Minus } from "lucide-react";
import type { PlanLimits, SaasPlan } from "@aichat/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Row {
  label: string;
  render: (limits: PlanLimits, plan: SaasPlan) => React.ReactNode;
}

function numCell(v: number): React.ReactNode {
  if (v < 0) return "∞";
  if (v === 0) return <Minus className="mx-auto h-3.5 w-3.5 text-zinc-300" />;
  return v;
}

function boolCell(v: boolean): React.ReactNode {
  return v ? (
    <Check className="mx-auto h-4 w-4 text-emerald-600" />
  ) : (
    <Minus className="mx-auto h-3.5 w-3.5 text-zinc-300" />
  );
}

const ROWS: Row[] = [
  {
    label: "Harga",
    render: (_l, p) =>
      p.price_idr > 0 ? (
        <span className="font-medium">
          Rp{p.price_idr.toLocaleString("id-ID")}
          <span className="text-[10px] text-muted-foreground">/bln</span>
        </span>
      ) : (
        <span className="font-medium">Gratis</span>
      ),
  },
  { label: "Anggota tim", render: (l) => numCell(l.team_members) },
  { label: "Knowledge docs", render: (l) => numCell(l.knowledge_documents) },
  { label: "Nomor WhatsApp", render: (l) => numCell(l.whatsapp_numbers) },
  {
    label: "Riwayat pesan",
    render: (l) =>
      l.message_history_days < 0
        ? "∞"
        : `${l.message_history_days} hari`,
  },
  { label: "Akses API", render: (l) => boolCell(l.api_access) },
  { label: "Integrasi n8n", render: (l) => boolCell(l.n8n_integration) },
  { label: "AI chatbot", render: (l) => boolCell(l.ai_chatbot) },
];

export function PlanComparison({
  plans,
  currentCode,
}: {
  plans: SaasPlan[];
  currentCode?: string;
}) {
  if (plans.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perbandingan paket</CardTitle>
        <CardDescription>
          Fitur & limit tiap paket berdampingan.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full border-t border-border text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Fitur
              </th>
              {plans.map((p) => (
                <th
                  key={p.id}
                  className={cn(
                    "px-4 py-2.5 text-center text-xs font-semibold",
                    p.code === currentCode
                      ? "bg-zinc-50 text-zinc-900"
                      : "text-zinc-700",
                  )}
                >
                  {p.name}
                  {p.code === currentCode && (
                    <span className="ml-1 rounded bg-zinc-900 px-1 py-px text-[9px] font-medium text-white">
                      aktif
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ROWS.map((row) => (
              <tr key={row.label}>
                <td className="px-4 py-2.5 text-xs text-zinc-600">
                  {row.label}
                </td>
                {plans.map((p) => (
                  <td
                    key={p.id}
                    className={cn(
                      "px-4 py-2.5 text-center text-xs",
                      p.code === currentCode && "bg-zinc-50",
                    )}
                  >
                    {row.render(p.limits, p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
