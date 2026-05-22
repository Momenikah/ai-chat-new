"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Trash2, Users } from "lucide-react";
import {
  SEGMENT_FIELDS,
  SEGMENT_OPERATORS,
  type Contact,
  type SegmentWithRules,
  type Tag,
} from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RuleDraft {
  field: string;
  operator: string;
  value: string;
}

export type SegmentDialogMode = "create" | "duplicate" | "edit";

const EMPTY_RULE: RuleDraft = {
  field: "name",
  operator: "contains",
  value: "",
};

export function SegmentDialog({
  workspaceId,
  tags,
  source,
  mode,
  open,
  onOpenChange,
  onSaved,
}: {
  workspaceId: string;
  tags: Tag[];
  /** Source segment for duplicate/edit modes; null/undefined for create. */
  source?: SegmentWithRules | null;
  mode: SegmentDialogMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#71717a");
  const [rules, setRules] = useState<RuleDraft[]>([EMPTY_RULE]);
  const [error, setError] = useState<string | null>(null);

  // Reset form whenever the dialog opens or source/mode changes.
  useEffect(() => {
    if (!open) return;
    if (source) {
      setName(
        mode === "duplicate" ? `${source.name} (copy)` : source.name,
      );
      setDescription(source.description ?? "");
      setColor(source.color);
      setRules(
        source.rules.length > 0
          ? source.rules.map((r) => ({
              field: r.field,
              operator: r.operator,
              value: r.value,
            }))
          : [EMPTY_RULE],
      );
    } else {
      setName("");
      setDescription("");
      setColor("#71717a");
      setRules([EMPTY_RULE]);
    }
    setError(null);
  }, [open, source, mode]);

  /* ----------------------- Live preview ------------------------------ */

  const contactsQuery = useQuery({
    queryKey: ["contacts", workspaceId, "", "", ""],
    queryFn: () => api.contacts.list(workspaceId, {}),
    enabled: open && Boolean(workspaceId),
    staleTime: 60_000,
  });

  const preview = useMemo(() => {
    const active = rules.filter((r) => r.value.trim() !== "");
    if (active.length === 0 || !contactsQuery.data) {
      return { count: null as number | null, hasTagRule: false, total: 0 };
    }
    const hasTagRule = active.some((r) => r.field === "tag");
    const evaluable = active.filter((r) => r.field !== "tag");
    const matches = contactsQuery.data.contacts.filter((c) =>
      evaluable.every((r) => matchRule(c, r)),
    );
    return {
      count: matches.length,
      hasTagRule,
      total: contactsQuery.data.contacts.length,
    };
  }, [rules, contactsQuery.data]);

  /* ----------------------- Submission ------------------------------- */

  const mutation = useMutation({
    mutationFn: async () => {
      setError(null);
      const cleanRules = rules.filter((r) => r.value.trim() !== "");
      const payload = {
        name,
        description: description || null,
        color,
        rules: cleanRules,
      };
      if (mode === "edit" && source) {
        const created = await api.segments.create(workspaceId, payload);
        // Delete the old one only after the new one is persisted.
        try {
          await api.segments.remove(workspaceId, source.id);
        } catch {
          // Old segment couldn't be removed — leave both in place; the new
          // one already exists so the user's intended state is reachable.
        }
        return created;
      }
      return api.segments.create(workspaceId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments", workspaceId] });
      onSaved();
      onOpenChange(false);
    },
    onError: (err) => {
      setError(
        err instanceof ApiException ? err.message : "Gagal menyimpan segment",
      );
    },
  });

  const title =
    mode === "edit"
      ? "Edit segment"
      : mode === "duplicate"
        ? "Duplicate segment"
        : "Buat segment";

  const description_ =
    mode === "edit"
      ? "Segment lama akan diganti dengan versi baru. Semua aturan digabungkan dengan AND."
      : mode === "duplicate"
        ? "Membuat salinan baru yang independen. Edit nama/aturan sebelum simpan."
        : "Semua aturan digabungkan dengan AND.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description_}</DialogDescription>
        </DialogHeader>

        <form
          id="segment-form"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="seg-name">Nama</Label>
            <Input
              id="seg-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="WhatsApp VIP"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seg-desc">Deskripsi</Label>
            <Input
              id="seg-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="opsional"
            />
          </div>
          <div className="space-y-2">
            <Label>Warna</Label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded-lg border border-input"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Aturan</Label>
              <button
                type="button"
                onClick={() => setRules((r) => [...r, { ...EMPTY_RULE }])}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
              >
                + tambah aturan
              </button>
            </div>
            {rules.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <Select
                  value={r.field}
                  onChange={(e) =>
                    setRules((rs) =>
                      rs.map((x, j) =>
                        j === i ? { ...x, field: e.target.value } : x,
                      ),
                    )
                  }
                  className="col-span-4 h-9 text-xs"
                >
                  {SEGMENT_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </Select>
                <Select
                  value={r.operator}
                  onChange={(e) =>
                    setRules((rs) =>
                      rs.map((x, j) =>
                        j === i ? { ...x, operator: e.target.value } : x,
                      ),
                    )
                  }
                  className="col-span-3 h-9 text-xs"
                >
                  {SEGMENT_OPERATORS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                {r.field === "tag" ? (
                  <Select
                    value={r.value}
                    onChange={(e) =>
                      setRules((rs) =>
                        rs.map((x, j) =>
                          j === i ? { ...x, value: e.target.value } : x,
                        ),
                      )
                    }
                    className="col-span-4 h-9 text-xs"
                  >
                    <option value="">— pilih tag —</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    className="col-span-4 h-9"
                    value={r.value}
                    onChange={(e) =>
                      setRules((rs) =>
                        rs.map((x, j) =>
                          j === i ? { ...x, value: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="nilai"
                  />
                )}
                <button
                  type="button"
                  onClick={() =>
                    setRules((rs) =>
                      rs.length === 1 ? rs : rs.filter((_, j) => j !== i),
                    )
                  }
                  className="col-span-1 flex h-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40"
                  disabled={rules.length === 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <PreviewPanel preview={preview} loading={contactsQuery.isLoading} />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button
            type="submit"
            form="segment-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {mode === "edit" ? "Simpan perubahan" : "Simpan segment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Preview --------------------------------- */

function PreviewPanel({
  preview,
  loading,
}: {
  preview: { count: number | null; hasTagRule: boolean; total: number };
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-zinc-50/60 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs text-zinc-700">
        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        <span className="font-medium">Live preview</span>
        <span className="ml-auto inline-flex items-center gap-1 text-zinc-600">
          <Users className="h-3 w-3" />
          {loading
            ? "menghitung…"
            : preview.count === null
              ? "—"
              : `${preview.hasTagRule ? "≈ " : ""}${preview.count} dari ${preview.total} kontak`}
        </span>
      </div>
      {preview.hasTagRule && preview.count !== null && (
        <p className="mt-1 text-[11px] text-amber-700">
          Filter <span className="font-medium">tag</span> dievaluasi di server —
          angka aktual dihitung setelah simpan.
        </p>
      )}
      {preview.count === null && !loading && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Isi nilai pada aturan untuk melihat estimasi.
        </p>
      )}
    </div>
  );
}

/* ----------------------- Rule evaluation -------------------------------- */

function matchRule(c: Contact, rule: RuleDraft): boolean {
  const v = rule.value.trim();
  if (!v) return true;
  const target = String(getContactField(c, rule.field) ?? "").toLowerCase();
  const value = v.toLowerCase();
  if (rule.operator === "equals") return target === value;
  return target.includes(value); // contains (default)
}

function getContactField(c: Contact, field: string): string | null {
  switch (field) {
    case "name":
      return c.name;
    case "phone":
      return c.phone;
    case "email":
      return c.email;
    case "location":
      return c.location;
    case "company":
      return c.company;
    case "channel":
      return c.external_source;
    default:
      return null;
  }
}
