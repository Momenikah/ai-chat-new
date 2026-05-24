"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Building2,
  Loader2,
  Search,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { initials } from "@/lib/utils";

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const enabled = debounced.length >= 2;

  const usersQ = useQuery({
    queryKey: ["admin", "search", "users", debounced],
    queryFn: () => api.admin.users(debounced),
    enabled,
  });
  const wsQ = useQuery({
    queryKey: ["admin", "search", "workspaces", debounced],
    queryFn: () => api.admin.workspaces(debounced),
    enabled,
  });

  const users = (usersQ.data?.users ?? []).slice(0, 5);
  const workspaces = (wsQ.data?.workspaces ?? []).slice(0, 5);
  const loading = enabled && (usersQ.isLoading || wsQ.isLoading);
  const showResults = enabled;

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari user atau workspace di seluruh platform…"
        className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-700"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-500" />
      )}

      <AnimatePresence>
        {showResults && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
          >
            {users.length === 0 && workspaces.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-zinc-500">
                Tidak ada hasil untuk “{debounced}”.
              </p>
            ) : (
              <div className="max-h-96 divide-y divide-zinc-800 overflow-y-auto">
                {users.length > 0 && (
                  <Section
                    label="Users"
                    icon={Users}
                    moreHref={`/admin/users?search=${encodeURIComponent(debounced)}`}
                  >
                    {users.map((u) => (
                      <Link
                        key={u.id}
                        href="/admin/users"
                        className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-zinc-800/60"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-200">
                          {initials(u.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-zinc-100">
                            {u.name}
                          </p>
                          <p className="truncate text-xs text-zinc-500">
                            {u.email}
                          </p>
                        </div>
                        {u.is_super_admin && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-px text-[10px] font-medium text-amber-300">
                            super
                          </span>
                        )}
                      </Link>
                    ))}
                  </Section>
                )}
                {workspaces.length > 0 && (
                  <Section
                    label="Workspaces"
                    icon={Building2}
                    moreHref={`/admin/workspaces?search=${encodeURIComponent(debounced)}`}
                  >
                    {workspaces.map((w) => (
                      <Link
                        key={w.id}
                        href="/admin/workspaces"
                        className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-zinc-800/60"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-300">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-zinc-100">
                            {w.name}
                          </p>
                          <p className="truncate font-mono text-xs text-zinc-500">
                            /{w.slug}
                            {w.owner_email ? ` · ${w.owner_email}` : ""}
                          </p>
                        </div>
                        {w.suspended_at && (
                          <span className="rounded bg-red-500/20 px-1.5 py-px text-[10px] font-medium text-red-300">
                            suspended
                          </span>
                        )}
                      </Link>
                    ))}
                  </Section>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({
  label,
  icon: Icon,
  moreHref,
  children,
}: {
  label: string;
  icon: typeof Users;
  moreHref: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/30 px-3 py-1.5">
        <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          <Icon className="h-3 w-3" /> {label}
        </p>
        <Link
          href={moreHref}
          className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200"
        >
          Lihat semua <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {children}
    </div>
  );
}
