"use client";

import { useRouter } from "next/navigation";
import { LogOut, Settings, UserRound } from "lucide-react";
import type { User } from "@aichat/shared";
import { api } from "@/lib/api";
import { clearTokens } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const reset = useAuthStore((s) => s.reset);
  const resetWorkspaces = useWorkspaceStore((s) => s.reset);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const currentId = useWorkspaceStore((s) => s.currentId);
  const role =
    workspaces.find((w) => w.id === currentId)?.member_role ?? null;

  async function handleLogout() {
    try {
      await api.auth.logout();
    } catch {
      /* logout is best-effort */
    } finally {
      clearTokens();
      reset();
      resetWorkspaces();
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-zinc-100">
          <Avatar className="h-8 w-8">
            {user.avatar_url && <AvatarImage src={user.avatar_url} />}
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left leading-tight sm:block">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Akun saya</span>
          {role && <Badge variant="secondary">{role}</Badge>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserRound className="h-4 w-4" />
          Profil
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Settings className="h-4 w-4" />
          Pengaturan akun
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleLogout}
          className="text-red-600 focus:bg-red-50 focus:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
