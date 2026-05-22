"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Lock } from "lucide-react";
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
  connected: "green",
  pending: "amber",
  error: "red",
  disconnected: "gray",
};

export default function AdminChannelsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "channels"],
    queryFn: api.admin.channels,
  });
  const channels = data?.channels ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <AdminHeader
        title="Channels"
        description="Koneksi channel seluruh workspace. Token tidak pernah ditampilkan."
      />

      {isLoading ? (
        <AdminLoading />
      ) : (
        <AdminCard>
          <AdminTable>
            <thead>
              <tr>
                <AdminTH>Channel</AdminTH>
                <AdminTH>Workspace</AdminTH>
                <AdminTH>Type</AdminTH>
                <AdminTH>Status</AdminTH>
                <AdminTH>Credentials</AdminTH>
                <AdminTH>External ID</AdminTH>
                <AdminTH>Terakhir terhubung</AdminTH>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id}>
                  <AdminTD className="text-zinc-100">{c.name}</AdminTD>
                  <AdminTD className="text-zinc-400">{c.workspace_name}</AdminTD>
                  <AdminTD>
                    <AdminBadge tone="blue">{c.type}</AdminBadge>
                  </AdminTD>
                  <AdminTD>
                    <AdminBadge tone={STATUS_TONE[c.status] ?? "gray"}>{c.status}</AdminBadge>
                  </AdminTD>
                  <AdminTD>
                    {c.has_credentials ? (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                        <Lock className="h-3.5 w-3.5" /> tersimpan (terenkripsi)
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </AdminTD>
                  <AdminTD className="font-mono text-xs text-zinc-500">
                    {c.external_id ?? "—"}
                  </AdminTD>
                  <AdminTD className="text-zinc-400">
                    {c.last_connected_at
                      ? new Date(c.last_connected_at).toLocaleString("id-ID")
                      : "—"}
                  </AdminTD>
                </tr>
              ))}
            </tbody>
          </AdminTable>
          {channels.length === 0 && <AdminEmpty message="Belum ada channel." />}
        </AdminCard>
      )}
    </motion.div>
  );
}
