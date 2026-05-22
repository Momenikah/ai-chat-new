"use client";

import Link from "next/link";
import { Bell, Search, ShieldAlert } from "lucide-react";
import type { User } from "@aichat/shared";
import { Button } from "@/components/ui/button";
import { UserMenu } from "./user-menu";

export function Topbar({ user }: { user: User }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-white/80 px-5 backdrop-blur">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Cari percakapan, kontak, atau menu…"
          className="h-9 w-full rounded-lg border border-input bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-zinc-300 focus:bg-white"
        />
      </div>

      <div className="flex-1" />

      {user.is_super_admin && (
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="gap-1.5 text-amber-600">
            <ShieldAlert className="h-4 w-4" />
            Super Admin
          </Button>
        </Link>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="relative"
        aria-label="Notifikasi"
      >
        <Bell className="h-[18px] w-[18px]" />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" />
      </Button>

      <div className="h-6 w-px bg-border" />

      <UserMenu user={user} />
    </header>
  );
}
