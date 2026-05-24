"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, UserPlus, X } from "lucide-react";
import type { MemberRole } from "@aichat/shared";
import { INVITABLE_ROLES } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Draft {
  email: string;
  role: MemberRole;
}

export function BulkInviteDialog({
  workspaceId,
  onInvited,
}: {
  workspaceId: string;
  onInvited: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([{ email: "", role: "AGENT" }]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [pending, setPending] = useState(false);

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts((d) => d.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function reset() {
    setDrafts([{ email: "", role: "AGENT" }]);
    setErrors({});
  }

  async function submit() {
    const rows = drafts
      .map((d, i) => ({ ...d, i, email: d.email.trim() }))
      .filter((d) => d.email.length > 0);
    if (rows.length === 0) return;

    setPending(true);
    setErrors({});
    const next: Record<number, string> = {};
    for (const row of rows) {
      try {
        await api.members.invite(workspaceId, {
          email: row.email,
          role: row.role,
        });
      } catch (e) {
        next[row.i] =
          e instanceof ApiException ? e.message : "Gagal mengundang";
      }
    }
    setPending(false);
    setErrors(next);
    queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
    onInvited();

    if (Object.keys(next).length === 0) {
      setOpen(false);
      reset();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" /> Undang anggota
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Undang anggota</DialogTitle>
          <DialogDescription>
            Tambah beberapa sekaligus. Jika email sudah punya akun, mereka
            langsung bergabung.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {drafts.map((d, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-start gap-2">
                <Input
                  type="email"
                  placeholder="agent@perusahaan.com"
                  value={d.email}
                  onChange={(e) => update(i, { email: e.target.value })}
                  className="flex-1"
                />
                <Select
                  value={d.role}
                  onChange={(e) =>
                    update(i, { role: e.target.value as MemberRole })
                  }
                  className="w-28"
                >
                  {INVITABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  disabled={drafts.length === 1}
                  onClick={() =>
                    setDrafts((rows) => rows.filter((_, j) => j !== i))
                  }
                  aria-label="Hapus baris"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {errors[i] && (
                <p className="text-xs text-red-600">{errors[i]}</p>
              )}
            </div>
          ))}
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setDrafts((d) => [...d, { email: "", role: "AGENT" }])}
        >
          <Plus className="h-3.5 w-3.5" /> Tambah baris
        </Button>

        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Kirim undangan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
