"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { api } from "@/lib/api";
import {
  AdminBadge,
  AdminCard,
  AdminEmpty,
  AdminHeader,
  AdminLoading,
  AdminTable,
  AdminTD,
  AdminTH,
} from "@/components/admin/admin-ui";

function formatIDR(n: number): string {
  if (!n) return "Rp0";
  return "Rp" + n.toLocaleString("id-ID");
}

const STATUS_TONE: Record<string, string> = {
  active: "green",
  trial: "amber",
  past_due: "red",
  cancelled: "gray",
};

export default function AdminSubscriptionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: api.admin.subscriptions,
  });
  const subs = data?.subscriptions ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <AdminHeader title="Subscriptions" description="Langganan seluruh workspace." />

      {isLoading ? (
        <AdminLoading />
      ) : (
        <AdminCard>
          <AdminTable>
            <thead>
              <tr>
                <AdminTH>Workspace</AdminTH>
                <AdminTH>Plan</AdminTH>
                <AdminTH>Harga</AdminTH>
                <AdminTH>Status</AdminTH>
                <AdminTH>Periode berakhir</AdminTH>
                <AdminTH>Dibuat</AdminTH>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <AdminTD className="text-zinc-100">{s.workspace_name}</AdminTD>
                  <AdminTD>
                    <AdminBadge tone="blue">{s.plan_code}</AdminBadge>
                  </AdminTD>
                  <AdminTD className="text-zinc-300">{formatIDR(s.price_idr)}</AdminTD>
                  <AdminTD>
                    <AdminBadge tone={STATUS_TONE[s.status] ?? "gray"}>{s.status}</AdminBadge>
                  </AdminTD>
                  <AdminTD className="text-zinc-400">
                    {s.current_period_end
                      ? new Date(s.current_period_end).toLocaleDateString("id-ID")
                      : "—"}
                  </AdminTD>
                  <AdminTD className="text-zinc-400">
                    {new Date(s.created_at).toLocaleDateString("id-ID")}
                  </AdminTD>
                </tr>
              ))}
            </tbody>
          </AdminTable>
          {subs.length === 0 && <AdminEmpty message="Belum ada subscription." />}
        </AdminCard>
      )}
    </motion.div>
  );
}
