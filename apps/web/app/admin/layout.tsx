"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CreditCard,
  FileWarning,
  LayoutDashboard,
  Plug,
  ScrollText,
  ShieldAlert,
  Users,
  ArrowLeft,
} from "lucide-react";
import { api, ApiException } from "@/lib/api";
import { clearTokens } from "@/lib/auth";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Workspaces", href: "/admin/workspaces", icon: Building2 },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
  { label: "Channels", href: "/admin/channels", icon: Plug },
  { label: "Logs", href: "/admin/logs", icon: ScrollText },
  { label: "Reports", href: "/admin/reports", icon: FileWarning },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: api.auth.me,
    retry: false,
  });

  useEffect(() => {
    const err = meQuery.error;
    if (err instanceof ApiException && err.status === 401) {
      clearTokens();
      router.replace("/login");
    }
  }, [meQuery.error, router]);

  // Bounce non-super-admins back to their dashboard.
  useEffect(() => {
    if (meQuery.data && !meQuery.data.is_super_admin) {
      router.replace("/dashboard");
    }
  }, [meQuery.data, router]);

  if (meQuery.isLoading || !meQuery.data) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-xl bg-amber-500">
            <ShieldAlert className="h-5 w-5 text-zinc-950" />
          </div>
          <p className="text-sm text-zinc-400">Memuat panel admin…</p>
        </div>
      </div>
    );
  }

  if (!meQuery.data.is_super_admin) {
    return null; // redirecting
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Admin sidebar — visually distinct (dark) from the tenant dashboard. */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
            <ShieldAlert className="h-4 w-4 text-zinc-950" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Super Admin</p>
            <p className="mt-0.5 text-xs text-zinc-500">Platform control</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {ADMIN_NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onMouseEnter={() => {
                  if (!active) router.prefetch(item.href);
                }}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke dashboard
          </Link>
          <p className="mt-2 px-3 text-xs text-zinc-600">{meQuery.data.email}</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
