"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Loader2, Mail, Search, Trash2 } from "lucide-react";
import type { MemberRole, WorkspaceMember } from "@aichat/shared";
import { api } from "@/lib/api";
import { initials } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamStats } from "@/components/team/team-stats";
import { SeatUsage } from "@/components/team/seat-usage";
import { RoleReference } from "@/components/team/role-reference";
import { BulkInviteDialog } from "@/components/team/bulk-invite-dialog";

const roleBadge: Record<MemberRole, "default" | "secondary" | "outline"> = {
  OWNER: "default",
  ADMIN: "secondary",
  AGENT: "outline",
  VIEWER: "outline",
};

export default function TeamPage() {
  const queryClient = useQueryClient();
  const currentId = useWorkspaceStore((s) => s.currentId);
  const can = useWorkspaceStore((s) => s.can);
  const canManage = can("ADMIN");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | MemberRole>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["members", currentId],
    queryFn: () => api.members.list(currentId as string),
    enabled: Boolean(currentId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["members", currentId] });

  const members = useMemo(() => data?.members ?? [], [data]);
  const invitations = useMemo(() => data?.invitations ?? [], [data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (
        q &&
        !m.user_name.toLowerCase().includes(q) &&
        !m.user_email.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [members, search, roleFilter]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-5"
    >
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tim</h1>
          <p className="text-sm text-muted-foreground">
            Kelola anggota dan undangan workspace ini.
          </p>
        </div>
        {canManage && currentId && (
          <BulkInviteDialog workspaceId={currentId} onInvited={invalidate} />
        )}
      </div>

      {!isLoading && (
        <TeamStats members={members} invitations={invitations} />
      )}

      {currentId && <SeatUsage workspaceId={currentId} />}

      <RoleReference />

      {members.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau email…"
              className="h-9 w-full rounded-lg border border-input bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:bg-white"
            />
          </div>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "all" | MemberRole)}
            className="h-9 w-36 text-sm"
          >
            <option value="all">Semua role</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="AGENT">Agent</option>
            <option value="VIEWER">Viewer</option>
          </Select>
        </div>
      )}

      {/* Members */}
      <Card>
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-medium">
            Anggota{" "}
            <span className="text-muted-foreground">({members.length})</span>
          </h2>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            {members.length === 0
              ? "Belum ada anggota."
              : "Tidak ada anggota yang cocok."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                canManage={canManage}
                onRemove={() =>
                  api.members.remove(currentId as string, m.id).then(invalidate)
                }
              />
            ))}
          </ul>
        )}
      </Card>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card>
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-medium">
              Undangan tertunda{" "}
              <span className="text-muted-foreground">
                ({invitations.length})
              </span>
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
                  <Mail className="h-4 w-4 text-amber-700" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Menunggu pendaftaran
                  </p>
                </div>
                <Badge variant={roleBadge[inv.role]}>{inv.role}</Badge>
                <Badge variant="warning">pending</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </motion.div>
  );
}

function MemberRow({
  member,
  canManage,
  onRemove,
}: {
  member: WorkspaceMember;
  canManage: boolean;
  onRemove: () => Promise<unknown>;
}) {
  const mutation = useMutation({ mutationFn: onRemove });
  const removable = canManage && member.role !== "OWNER";

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
        {initials(member.user_name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{member.user_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {member.user_email}
        </p>
      </div>
      <Badge variant={member.status === "active" ? "success" : "warning"}>
        {member.status}
      </Badge>
      <Badge variant={roleBadge[member.role]}>{member.role}</Badge>
      {removable && (
        <Button
          size="icon"
          variant="ghost"
          className="text-red-600 hover:bg-red-50 hover:text-red-600"
          disabled={mutation.isPending}
          onClick={() => {
            if (confirm(`Hapus ${member.user_name} dari workspace?`)) {
              mutation.mutate();
            }
          }}
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      )}
    </li>
  );
}
