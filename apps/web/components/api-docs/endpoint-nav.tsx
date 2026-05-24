"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ENDPOINTS } from "@/components/api-docs/endpoint-spec";
import { cn } from "@/lib/utils";

export function EndpointNav() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return ENDPOINTS;
    return ENDPOINTS.filter(
      (e) =>
        e.path.toLowerCase().includes(query) ||
        e.method.toLowerCase().includes(query) ||
        e.desc.toLowerCase().includes(query),
    );
  }, [q]);

  return (
    <nav className="lg:sticky lg:top-6">
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari endpoint…"
          className="h-8 w-full rounded-lg border border-input bg-zinc-50 pl-8 pr-2 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:bg-white"
        />
      </div>
      <ul className="space-y-0.5">
        {filtered.map((e) => (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <span
                className={cn(
                  "shrink-0 rounded px-1 py-px font-mono text-[9px] font-semibold",
                  e.method === "GET"
                    ? "bg-sky-100 text-sky-700"
                    : "bg-emerald-100 text-emerald-700",
                )}
              >
                {e.method}
              </span>
              <span className="truncate font-mono">
                {e.path.replace("/public", "")}
              </span>
            </a>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-2 py-1 text-xs text-muted-foreground">
            Tidak ada yang cocok.
          </li>
        )}
      </ul>
    </nav>
  );
}
