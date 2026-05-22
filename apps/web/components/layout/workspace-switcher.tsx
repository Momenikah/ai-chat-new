"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const currentId = useWorkspaceStore((s) => s.currentId);
  const setCurrentId = useWorkspaceStore((s) => s.setCurrentId);

  const current = workspaces.find((w) => w.id === currentId) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg border border-border bg-white px-2.5 py-2 text-left transition-colors hover:bg-zinc-50",
            collapsed && "justify-center px-0",
          )}
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
            style={{ background: current?.brand_color ?? "#18181b" }}
          >
            {current ? current.name.charAt(0).toUpperCase() : "?"}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {current?.name ?? "Pilih workspace"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {current ? current.member_role : "—"}
                </span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspace Anda</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onSelect={() => setCurrentId(w.id)}
            className="gap-2.5"
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white"
              style={{ background: w.brand_color }}
            >
              {w.name.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate">{w.name}</span>
            <Badge variant="secondary" className="shrink-0">
              {w.member_role}
            </Badge>
            {w.id === currentId && (
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/dashboard/workspaces")}>
          <Plus className="h-4 w-4" />
          Kelola / buat workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
