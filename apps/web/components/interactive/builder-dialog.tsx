"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import type {
  CarouselPayload,
  InteractiveKind,
  InteractiveMessage,
  InteractivePayload,
  ListPayload,
  ReplyButtonsPayload,
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
import { KIND_META, emptyPayload } from "@/components/interactive/interactive-shared";
import { InteractivePreview } from "@/components/interactive/interactive-preview";

export type BuilderInitial =
  | { mode: "create"; name: string; kind: InteractiveKind; payload: InteractivePayload }
  | { mode: "edit"; item: InteractiveMessage }
  | { mode: "duplicate"; name: string; kind: InteractiveKind; payload: InteractivePayload };

export function BuilderDialog({
  workspaceId,
  initial,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  initial: BuilderInitial;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = initial.mode === "edit";

  const [name, setName] = useState(
    initial.mode === "edit" ? initial.item.name : initial.name,
  );
  const [kind, setKind] = useState<InteractiveKind>(
    initial.mode === "edit" ? initial.item.kind : initial.kind,
  );
  const [payload, setPayload] = useState<InteractivePayload>(
    initial.mode === "edit" ? initial.item.payload : initial.payload,
  );

  // Re-sync if the dialog is reused for a different target.
  useEffect(() => {
    if (initial.mode === "edit") {
      setName(initial.item.name);
      setKind(initial.item.kind);
      setPayload(initial.item.payload);
    } else {
      setName(initial.name);
      setKind(initial.kind);
      setPayload(initial.payload);
    }
  }, [initial]);

  const mutation = useMutation({
    mutationFn: () =>
      initial.mode === "edit"
        ? api.interactives.update(workspaceId, initial.item.id, {
            name,
            payload,
          })
        : api.interactives.create(workspaceId, { name, kind, payload }),
    onSuccess: onSaved,
  });

  const error =
    mutation.error instanceof ApiException ? mutation.error.message : null;

  const title =
    initial.mode === "edit"
      ? "Edit interactive message"
      : initial.mode === "duplicate"
        ? "Duplicate interactive message"
        : "Buat interactive message";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Builder menghasilkan payload Meta interactive yang siap kirim.
            Preview di kanan update real-time.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_240px]">
          <form
            id="ix-form"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="space-y-4"
          >
            {/* Kind picker — locked when editing (kind is immutable server-side). */}
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(KIND_META) as InteractiveKind[]).map((k) => {
                const meta = KIND_META[k];
                const Icon = meta.icon;
                const active = k === kind;
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={isEdit}
                    onClick={() => {
                      setKind(k);
                      setPayload(emptyPayload(k));
                    }}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                      active
                        ? "border-zinc-900 ring-1 ring-zinc-900"
                        : "border-border hover:border-zinc-300"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{meta.label}</span>
                  </button>
                );
              })}
            </div>
            {isEdit && (
              <p className="text-[11px] text-muted-foreground">
                Tipe tidak dapat diubah saat edit. Buat baru bila ingin tipe
                lain.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="ix-name">Nama (internal)</Label>
              <Input
                id="ix-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="welcome_menu"
              />
            </div>

            {kind === "reply_buttons" && (
              <ReplyButtonsBuilder
                value={payload as ReplyButtonsPayload}
                onChange={setPayload}
              />
            )}
            {kind === "list" && (
              <ListBuilder
                value={payload as ListPayload}
                onChange={setPayload}
              />
            )}
            {kind === "carousel" && (
              <CarouselBuilder
                value={payload as CarouselPayload}
                onChange={setPayload}
              />
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
          </form>

          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Preview
            </p>
            <InteractivePreview kind={kind} payload={payload} />
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" form="ix-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Simpan perubahan" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Sub-builders --------------------------- */

function ReplyButtonsBuilder({
  value,
  onChange,
}: {
  value: ReplyButtonsPayload;
  onChange: (v: ReplyButtonsPayload) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Body</Label>
        <textarea
          value={value.body}
          onChange={(e) => onChange({ ...value, body: e.target.value })}
          rows={2}
          placeholder="Mau dilanjut ke mana?"
          className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        />
      </div>
      <div className="space-y-2">
        <Label>Buttons (max 3)</Label>
        {value.buttons.map((b, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <Input
              className="col-span-3 h-8 text-xs font-mono"
              placeholder="id"
              value={b.id}
              onChange={(e) => {
                const next = [...value.buttons];
                next[i] = { ...b, id: e.target.value };
                onChange({ ...value, buttons: next });
              }}
            />
            <Input
              className="col-span-8 h-8 text-xs"
              placeholder="title"
              value={b.title}
              onChange={(e) => {
                const next = [...value.buttons];
                next[i] = { ...b, title: e.target.value };
                onChange({ ...value, buttons: next });
              }}
            />
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  buttons: value.buttons.filter((_, j) => j !== i),
                })
              }
              className="col-span-1 flex h-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {value.buttons.length < 3 && (
          <button
            type="button"
            onClick={() =>
              onChange({
                ...value,
                buttons: [
                  ...value.buttons,
                  { id: `btn_${value.buttons.length + 1}`, title: "" },
                ],
              })
            }
            className="rounded-md border border-dashed border-zinc-300 px-2 py-1 text-xs text-muted-foreground hover:border-zinc-500"
          >
            + tambah button
          </button>
        )}
      </div>
    </div>
  );
}

function ListBuilder({
  value,
  onChange,
}: {
  value: ListPayload;
  onChange: (v: ListPayload) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Body</Label>
        <textarea
          value={value.body}
          onChange={(e) => onChange({ ...value, body: e.target.value })}
          rows={2}
          className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        />
      </div>
      <div className="space-y-2">
        <Label>Tombol pemicu</Label>
        <Input
          value={value.button_text}
          onChange={(e) => onChange({ ...value, button_text: e.target.value })}
          placeholder="Pilih opsi"
        />
      </div>
      <div className="space-y-2">
        <Label>Sections</Label>
        {value.sections.map((s, si) => (
          <div key={si} className="space-y-2 rounded-lg border border-border p-3">
            <Input
              placeholder="Section title"
              value={s.title}
              onChange={(e) => {
                const next = [...value.sections];
                next[si] = { ...s, title: e.target.value };
                onChange({ ...value, sections: next });
              }}
            />
            {s.rows.map((r, ri) => (
              <div key={ri} className="grid grid-cols-12 gap-2">
                <Input
                  className="col-span-3 h-8 text-xs font-mono"
                  placeholder="id"
                  value={r.id}
                  onChange={(e) => {
                    const next = [...value.sections];
                    next[si].rows[ri] = { ...r, id: e.target.value };
                    onChange({ ...value, sections: next });
                  }}
                />
                <Input
                  className="col-span-4 h-8 text-xs"
                  placeholder="title"
                  value={r.title}
                  onChange={(e) => {
                    const next = [...value.sections];
                    next[si].rows[ri] = { ...r, title: e.target.value };
                    onChange({ ...value, sections: next });
                  }}
                />
                <Input
                  className="col-span-4 h-8 text-xs"
                  placeholder="description (opsional)"
                  value={r.description ?? ""}
                  onChange={(e) => {
                    const next = [...value.sections];
                    next[si].rows[ri] = { ...r, description: e.target.value };
                    onChange({ ...value, sections: next });
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = [...value.sections];
                    next[si].rows = s.rows.filter((_, j) => j !== ri);
                    onChange({ ...value, sections: next });
                  }}
                  className="col-span-1 flex h-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const next = [...value.sections];
                next[si].rows = [
                  ...s.rows,
                  { id: `row_${s.rows.length + 1}`, title: "" },
                ];
                onChange({ ...value, sections: next });
              }}
              className="rounded-md border border-dashed border-zinc-300 px-2 py-1 text-xs text-muted-foreground hover:border-zinc-500"
            >
              + row
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              sections: [
                ...value.sections,
                {
                  title: `Section ${value.sections.length + 1}`,
                  rows: [{ id: "row_1", title: "" }],
                },
              ],
            })
          }
          className="rounded-md border border-dashed border-zinc-300 px-2 py-1 text-xs text-muted-foreground hover:border-zinc-500"
        >
          + section
        </button>
      </div>
    </div>
  );
}

function CarouselBuilder({
  value,
  onChange,
}: {
  value: CarouselPayload;
  onChange: (v: CarouselPayload) => void;
}) {
  return (
    <div className="space-y-3">
      {value.cards.map((c, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Image URL"
              value={c.image_url}
              onChange={(e) => {
                const next = [...value.cards];
                next[i] = { ...c, image_url: e.target.value };
                onChange({ cards: next });
              }}
            />
            <Input
              placeholder="Title"
              value={c.title}
              onChange={(e) => {
                const next = [...value.cards];
                next[i] = { ...c, title: e.target.value };
                onChange({ cards: next });
              }}
            />
          </div>
          <Input
            placeholder="Subtitle (opsional)"
            value={c.subtitle ?? ""}
            onChange={(e) => {
              const next = [...value.cards];
              next[i] = { ...c, subtitle: e.target.value };
              onChange({ cards: next });
            }}
          />
          <div className="flex items-center gap-2">
            <Select
              className="h-8 w-32 text-xs"
              value={c.button?.type ?? ""}
              onChange={(e) => {
                const next = [...value.cards];
                if (e.target.value === "") {
                  next[i] = { ...c, button: undefined };
                } else {
                  next[i] = {
                    ...c,
                    button: {
                      type: e.target.value as "url" | "reply",
                      text: c.button?.text ?? "",
                      url: c.button?.url,
                    },
                  };
                }
                onChange({ cards: next });
              }}
            >
              <option value="">no button</option>
              <option value="reply">reply</option>
              <option value="url">url</option>
            </Select>
            {c.button && (
              <Input
                className="h-8 flex-1 text-xs"
                placeholder="button text"
                value={c.button.text}
                onChange={(e) => {
                  const next = [...value.cards];
                  next[i] = {
                    ...c,
                    button: { ...c.button!, text: e.target.value },
                  };
                  onChange({ cards: next });
                }}
              />
            )}
            {c.button?.type === "url" && (
              <Input
                className="h-8 flex-1 text-xs"
                placeholder="https://…"
                value={c.button.url ?? ""}
                onChange={(e) => {
                  const next = [...value.cards];
                  next[i] = {
                    ...c,
                    button: { ...c.button!, url: e.target.value },
                  };
                  onChange({ cards: next });
                }}
              />
            )}
            <button
              type="button"
              onClick={() =>
                onChange({ cards: value.cards.filter((_, j) => j !== i) })
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            cards: [...value.cards, { image_url: "", title: "", subtitle: "" }],
          })
        }
        className="rounded-md border border-dashed border-zinc-300 px-2 py-1 text-xs text-muted-foreground hover:border-zinc-500"
      >
        + kartu
      </button>
    </div>
  );
}
