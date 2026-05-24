"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import type { AbuseReport } from "@aichat/shared";
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

const STATUS_TONE: Record<string, string> = {
  open: "amber",
  reviewing: "blue",
  resolved: "green",
  dismissed: "gray",
};

const FILTERS = ["", "open", "reviewing", "resolved", "dismissed"];

export default function AdminReportsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reports", status],
    queryFn: () => api.admin.reports(status),
  });

  const update = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      api.admin.resolveReport(id, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
  });

  const reports = data?.reports ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <AdminHeader title="Abuse Reports" description="Laporan spam / penyalahgunaan." />

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f || "all"}
            onClick={() => setStatus(f)}
            className={`rounded-md px-2.5 py-1 text-xs ${
              status === f ? "bg-zinc-700 text-white" : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {f || "semua"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <AdminLoading />
      ) : (
        <AdminCard>
          <AdminTable>
            <thead>
              <tr>
                <AdminTH>Workspace</AdminTH>
                <AdminTH>Kategori</AdminTH>
                <AdminTH>Deskripsi</AdminTH>
                <AdminTH>Status</AdminTH>
                <AdminTH>Aksi</AdminTH>
              </tr>
            </thead>
            <tbody>
              {reports.map((r: AbuseReport) => {
                const busy = update.isPending && update.variables?.id === r.id;
                return (
                  <tr key={r.id}>
                    <AdminTD className="text-zinc-200">
                      {r.workspace_name ?? "—"}
                      <p className="text-xs text-zinc-500">{r.reporter_email ?? ""}</p>
                    </AdminTD>
                    <AdminTD>
                      <AdminBadge tone="blue">{r.category}</AdminBadge>
                    </AdminTD>
                    <AdminTD className="max-w-xs text-zinc-400">
                      <span className="line-clamp-2">{r.description}</span>
                    </AdminTD>
                    <AdminTD>
                      <AdminBadge tone={STATUS_TONE[r.status] ?? "gray"}>{r.status}</AdminBadge>
                    </AdminTD>
                    <AdminTD>
                      <div className="flex items-center gap-1.5">
                        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                        {r.status !== "resolved" && (
                          <button
                            onClick={() => update.mutate({ id: r.id, next: "resolved" })}
                            disabled={busy}
                            className="rounded-md border border-emerald-700/50 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                          >
                            Resolve
                          </button>
                        )}
                        {r.status !== "dismissed" && (
                          <button
                            onClick={() => update.mutate({ id: r.id, next: "dismissed" })}
                            disabled={busy}
                            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    </AdminTD>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
          {reports.length === 0 && <AdminEmpty message="Tidak ada laporan." />}
        </AdminCard>
      )}
    </motion.div>
  );
}
