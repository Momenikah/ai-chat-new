"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ContactsPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (next: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-white px-3 py-2 text-xs text-zinc-600">
      <span>
        Menampilkan{" "}
        <span className="font-medium text-zinc-900">
          {start}–{end}
        </span>{" "}
        dari <span className="font-medium text-zinc-900">{total}</span>
      </span>
      <div className="flex items-center gap-1">
        <PageBtn
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Sebelumnya"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </PageBtn>
        <span className="px-2">
          Hal. <span className="font-medium text-zinc-900">{page}</span> /{" "}
          {totalPages}
        </span>
        <PageBtn
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Berikutnya"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </PageBtn>
      </div>
    </div>
  );
}

function PageBtn({
  children,
  disabled,
  onClick,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}
