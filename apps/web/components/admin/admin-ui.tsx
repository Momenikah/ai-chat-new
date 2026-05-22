"use client";

import { useState } from "react";
import { Search } from "lucide-react";

/** Dark-themed page header for the admin panel. */
export function AdminHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-zinc-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Debounced-ish search box (updates on submit / change). */
export function AdminSearch({
  placeholder,
  onSearch,
}: {
  placeholder: string;
  onSearch: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(value.trim());
      }}
      className="relative w-64"
    >
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-600"
      />
    </form>
  );
}

/** Card wrapper around a table. */
export function AdminCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      {children}
    </div>
  );
}

export function AdminTable({ children }: { children: React.ReactNode }) {
  return <table className="w-full text-left text-sm">{children}</table>;
}

export function AdminTH({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-zinc-800 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
      {children}
    </th>
  );
}

export function AdminTD({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`border-b border-zinc-800/60 px-4 py-3 align-middle ${className ?? ""}`}>
      {children}
    </td>
  );
}

const TONE: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-300",
  red: "bg-red-500/15 text-red-300",
  amber: "bg-amber-500/15 text-amber-300",
  gray: "bg-zinc-700/40 text-zinc-300",
  blue: "bg-blue-500/15 text-blue-300",
};

export function AdminBadge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE | string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${TONE[tone] ?? TONE.gray}`}
    >
      {children}
    </span>
  );
}

export function AdminEmpty({ message }: { message: string }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-zinc-500">{message}</div>
  );
}

export function AdminLoading() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-900" />
      ))}
    </div>
  );
}
