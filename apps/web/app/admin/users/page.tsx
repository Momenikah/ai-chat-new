"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Loader2, UserCog } from "lucide-react";
import type { ImpersonateResult } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
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

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [impersonation, setImpersonation] = useState<ImpersonateResult | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", search],
    queryFn: () => api.admin.users(search),
  });

  const impersonate = useMutation({
    mutationFn: (id: string) => api.admin.impersonate(id),
    onSuccess: (res) => setImpersonation(res),
  });

  const users = data?.users ?? [];
  const err = impersonate.error instanceof ApiException ? impersonate.error.message : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <AdminHeader
        title="Users"
        description="Semua akun di platform."
        action={<AdminSearch placeholder="Cari nama / email…" onSearch={setSearch} />}
      />

      {impersonation && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p className="font-medium">
            Impersonate {impersonation.target_email} (ref:{" "}
            <span className="font-mono">{impersonation.impersonate_ref}</span>)
          </p>
          <p className="mt-1 text-amber-200/80">{impersonation.note}</p>
        </div>
      )}
      {err && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</div>
      )}

      {isLoading ? (
        <AdminLoading />
      ) : (
        <AdminCard>
          <AdminTable>
            <thead>
              <tr>
                <AdminTH>User</AdminTH>
                <AdminTH>Workspaces</AdminTH>
                <AdminTH>Status</AdminTH>
                <AdminTH>Last login</AdminTH>
                <AdminTH>Joined</AdminTH>
                <AdminTH>Aksi</AdminTH>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <AdminTD>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-100">{u.name}</span>
                      {u.is_super_admin && <AdminBadge tone="amber">SUPER</AdminBadge>}
                    </div>
                    <p className="text-xs text-zinc-500">{u.email}</p>
                  </AdminTD>
                  <AdminTD>{u.workspace_count}</AdminTD>
                  <AdminTD>
                    {u.is_active ? (
                      <AdminBadge tone="green">active</AdminBadge>
                    ) : (
                      <AdminBadge tone="red">inactive</AdminBadge>
                    )}
                  </AdminTD>
                  <AdminTD className="text-zinc-400">
                    {u.last_login_at
                      ? new Date(u.last_login_at).toLocaleString("id-ID")
                      : "—"}
                  </AdminTD>
                  <AdminTD className="text-zinc-400">
                    {new Date(u.created_at).toLocaleDateString("id-ID")}
                  </AdminTD>
                  <AdminTD>
                    <button
                      onClick={() => impersonate.mutate(u.id)}
                      disabled={impersonate.isPending}
                      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {impersonate.isPending && impersonate.variables === u.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserCog className="h-3.5 w-3.5" />
                      )}
                      Impersonate
                    </button>
                  </AdminTD>
                </tr>
              ))}
            </tbody>
          </AdminTable>
          {users.length === 0 && <AdminEmpty message="Tidak ada user." />}
        </AdminCard>
      )}
    </motion.div>
  );
}
