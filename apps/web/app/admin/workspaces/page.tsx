"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Loader2, PauseCircle, PlayCircle } from "lucide-react";
import { api } from "@/lib/api";
import {
  AdminBadge,
  AdminCard,
  AdminEmpty,
  AdminHeader,
  AdminLoading,
  AdminSearch,
  AdminTable,
  AdminTD,
  AdminTH,
} from "@/components/admin/admin-ui";

export default function AdminWorkspacesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "workspaces", search],
    queryFn: () => api.admin.workspaces(search),
  });

  const suspend = useMutation({
    mutationFn: ({
      id,
      suspended,
      reason,
    }: {
      id: string;
      suspended: boolean;
      reason?: string;
    }) => api.admin.suspend(id, suspended, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
  });

  const workspaces = data?.workspaces ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <AdminHeader
        title="Workspaces"
        description="Semua tenant di platform."
        action={<AdminSearch placeholder="Cari nama / slug…" onSearch={setSearch} />}
      />

      {isLoading ? (
        <AdminLoading />
      ) : (
        <AdminCard>
          <AdminTable>
            <thead>
              <tr>
                <AdminTH>Workspace</AdminTH>
                <AdminTH>Owner</AdminTH>
                <AdminTH>Members</AdminTH>
                <AdminTH>Channels</AdminTH>
                <AdminTH>Plan</AdminTH>
                <AdminTH>Status</AdminTH>
                <AdminTH>Aksi</AdminTH>
              </tr>
            </thead>
            <tbody>
              {workspaces.map((w) => {
                const suspended = Boolean(w.suspended_at);
                const busy = suspend.isPending && suspend.variables?.id === w.id;
                return (
                  <tr key={w.id}>
                    <AdminTD>
                      <p className="text-zinc-100">{w.name}</p>
                      <p className="font-mono text-xs text-zinc-500">{w.slug}</p>
                    </AdminTD>
                    <AdminTD className="text-zinc-400">{w.owner_email ?? "—"}</AdminTD>
                    <AdminTD>{w.member_count}</AdminTD>
                    <AdminTD>{w.channel_count}</AdminTD>
                    <AdminTD>
                      <AdminBadge tone="blue">{w.plan_code ?? "FREE"}</AdminBadge>
                    </AdminTD>
                    <AdminTD>
                      {suspended ? (
                        <AdminBadge tone="red">suspended</AdminBadge>
                      ) : (
                        <AdminBadge tone="green">active</AdminBadge>
                      )}
                    </AdminTD>
                    <AdminTD>
                      {suspended ? (
                        <button
                          onClick={() => suspend.mutate({ id: w.id, suspended: false })}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700/50 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                          Aktifkan
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const reason = prompt(`Alasan suspend "${w.name}"?`) ?? "";
                            suspend.mutate({ id: w.id, suspended: true, reason });
                          }}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-700/50 px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="h-3.5 w-3.5" />}
                          Suspend
                        </button>
                      )}
                    </AdminTD>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
          {workspaces.length === 0 && <AdminEmpty message="Tidak ada workspace." />}
        </AdminCard>
      )}
    </motion.div>
  );
}
