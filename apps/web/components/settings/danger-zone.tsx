"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { Workspace } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DangerZone({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const reset = useWorkspaceStore((s) => s.reset);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  const remove = useMutation({
    mutationFn: () => api.workspaces.remove(workspace.id),
    onSuccess: () => {
      reset();
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setOpen(false);
      router.push("/dashboard/workspaces");
    },
  });

  const err = remove.error instanceof ApiException ? remove.error.message : null;
  const match = confirm.trim() === workspace.name;

  return (
    <Card className="border-red-200">
      <div className="border-b border-red-100 bg-red-50/40 px-5 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium">Hapus workspace</p>
          <p className="text-xs text-muted-foreground">
            Menghapus permanen workspace beserta channel, kontak, percakapan,
            dan data lainnya. Tindakan ini tidak dapat dibatalkan.
          </p>
        </div>

        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setConfirm("");
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" className="shrink-0 border-red-300 text-red-600 hover:bg-red-50">
              Hapus workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-700">
                Hapus “{workspace.name}”?
              </DialogTitle>
              <DialogDescription>
                Semua data workspace akan hilang permanen. Ketik nama workspace
                untuk mengonfirmasi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="confirm-name">
                Ketik <span className="font-semibold">{workspace.name}</span>
              </Label>
              <Input
                id="confirm-name"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={workspace.name}
                autoComplete="off"
              />
              {err && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {err}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="destructive"
                disabled={!match || remove.isPending}
                onClick={() => remove.mutate()}
              >
                {remove.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Hapus permanen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}
