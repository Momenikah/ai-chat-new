"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface HeaderRow {
  key: string;
  value: string;
}

/** Convert a header record to an editable row list. */
export function headersToRows(
  headers: Record<string, string> | undefined,
): HeaderRow[] {
  if (!headers) return [];
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}

/** Convert rows back to a record, dropping empty keys. */
export function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (k) out[k] = r.value;
  }
  return out;
}

export function HeadersEditor({
  rows,
  onChange,
}: {
  rows: HeaderRow[];
  onChange: (rows: HeaderRow[]) => void;
}) {
  const update = (i: number, patch: Partial<HeaderRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      <Label>Custom headers (opsional)</Label>
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <Input
                className="col-span-5 h-8 text-xs font-mono"
                placeholder="Authorization"
                value={r.key}
                onChange={(e) => update(i, { key: e.target.value })}
              />
              <Input
                className="col-span-6 h-8 text-xs font-mono"
                placeholder="Bearer xxx"
                value={r.value}
                onChange={(e) => update(i, { value: e.target.value })}
              />
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                className="col-span-1 flex h-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                aria-label="Hapus header"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => onChange([...rows, { key: "", value: "" }])}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-zinc-300 px-2.5 py-1 text-xs text-muted-foreground hover:border-zinc-500 hover:text-zinc-700"
      >
        <Plus className="h-3 w-3" /> Tambah header
      </button>
      <p className="text-xs text-muted-foreground">
        Header tambahan dikirim di setiap request (mis. token auth endpoint
        Anda).
      </p>
    </div>
  );
}
