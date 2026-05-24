"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import {
  TEMPLATE_CATEGORIES,
  type TemplateButton,
  type TemplateCategory,
  type TemplateVariable,
} from "@aichat/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** WhatsApp Cloud API body limit. */
const BODY_LIMIT = 1024;

export interface TemplateEditorValues {
  name: string;
  category: TemplateCategory;
  language: string;
  body: string;
  footer: string;
  buttons: TemplateButton[];
  variables: { name: string; label?: string; sample_value?: string }[];
}

export const EMPTY_TEMPLATE: TemplateEditorValues = {
  name: "",
  category: "utility",
  language: "id",
  body: "",
  footer: "",
  buttons: [],
  variables: [],
};

/** Extract `{{var}}` placeholders so the variable list stays in sync. */
function extractPlaceholders(body: string): string[] {
  const re = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of body.matchAll(re)) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

export function TemplateEditor({
  values,
  onChange,
  submitting,
  onSubmit,
  submitLabel,
  error,
  disabled,
}: {
  values: TemplateEditorValues;
  onChange: (v: TemplateEditorValues) => void;
  submitting?: boolean;
  onSubmit: () => void;
  submitLabel: string;
  error?: string | null;
  disabled?: boolean;
}) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Keep the variable list aligned with placeholders in the body.
  useEffect(() => {
    const placeholders = extractPlaceholders(values.body);
    const byName = new Map(values.variables.map((v) => [v.name, v]));
    const next = placeholders.map(
      (name) => byName.get(name) ?? { name, sample_value: "" },
    );
    if (
      next.length !== values.variables.length ||
      next.some((v, i) => v.name !== values.variables[i]?.name)
    ) {
      onChange({ ...values, variables: next });
    }
  }, [values.body, values, onChange]);

  function insertAtCursor(text: string) {
    const ta = bodyRef.current;
    if (!ta) {
      onChange({ ...values, body: values.body + text });
      return;
    }
    const start = ta.selectionStart ?? values.body.length;
    const end = ta.selectionEnd ?? values.body.length;
    const next = values.body.slice(0, start) + text + values.body.slice(end);
    onChange({ ...values, body: next });
    // Restore caret after React re-renders.
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  const bodyLength = values.body.length;
  const overLimit = bodyLength > BODY_LIMIT;
  const missingSamples = values.variables.filter(
    (v) => !v.sample_value || !v.sample_value.trim(),
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-5"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tpl-name">Nama template</Label>
          <Input
            id="tpl-name"
            required
            disabled={disabled}
            value={values.name}
            onChange={(e) => onChange({ ...values, name: e.target.value })}
            placeholder="order_confirmation"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tpl-category">Kategori</Label>
          <Select
            id="tpl-category"
            disabled={disabled}
            value={values.category}
            onChange={(e) =>
              onChange({
                ...values,
                category: e.target.value as TemplateCategory,
              })
            }
          >
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tpl-language">Bahasa</Label>
        <Input
          id="tpl-language"
          className="w-32"
          disabled={disabled}
          value={values.language}
          onChange={(e) => onChange({ ...values, language: e.target.value })}
          placeholder="id"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="tpl-body">
            Body{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (gunakan <code>{`{{name}}`}</code> untuk variabel)
            </span>
          </Label>
          <span
            className={cn(
              "tabular-nums text-[11px]",
              overLimit
                ? "font-semibold text-red-600"
                : bodyLength > BODY_LIMIT * 0.9
                  ? "text-amber-600"
                  : "text-muted-foreground",
            )}
          >
            {bodyLength} / {BODY_LIMIT}
          </span>
        </div>
        <textarea
          ref={bodyRef}
          id="tpl-body"
          rows={6}
          required
          disabled={disabled}
          value={values.body}
          onChange={(e) => onChange({ ...values, body: e.target.value })}
          placeholder="Hai {{name}}, pesanan Anda dengan no {{order_id}} sudah dikemas."
          className={cn(
            "w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm font-mono shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            overLimit ? "border-red-300" : "border-input",
          )}
        />
        <VariableSuggestions
          onPick={(name) => insertAtCursor(`{{${name}}}`)}
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tpl-footer">Footer (opsional)</Label>
        <Input
          id="tpl-footer"
          disabled={disabled}
          value={values.footer}
          onChange={(e) => onChange({ ...values, footer: e.target.value })}
          placeholder="Tim Customer Care"
        />
      </div>

      {values.variables.length > 0 && (
        <div className="space-y-2">
          <Label>Sample value</Label>
          <div className="space-y-2">
            {values.variables.map((v, i) => (
              <div key={v.name} className="flex items-center gap-2 text-sm">
                <code className="w-32 shrink-0 rounded bg-zinc-100 px-2 py-1 text-xs">
                  {`{{${v.name}}}`}
                </code>
                <Input
                  placeholder="contoh nilai"
                  disabled={disabled}
                  value={v.sample_value ?? ""}
                  onChange={(e) => {
                    const next = [...values.variables];
                    next[i] = { ...v, sample_value: e.target.value };
                    onChange({ ...values, variables: next });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <ButtonBuilder
        buttons={values.buttons}
        onChange={(b) => onChange({ ...values, buttons: b })}
        disabled={disabled}
      />

      {(missingSamples.length > 0 || overLimit) && !disabled && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="space-y-0.5">
            {overLimit && (
              <p>
                Body melampaui batas Meta ({bodyLength}/{BODY_LIMIT} karakter).
                Persingkat sebelum submit.
              </p>
            )}
            {missingSamples.length > 0 && (
              <p>
                {missingSamples.length} variabel belum punya sample value:{" "}
                {missingSamples
                  .slice(0, 4)
                  .map((v) => `{{${v.name}}}`)
                  .join(", ")}
                {missingSamples.length > 4 &&
                  ` +${missingSamples.length - 4} lainnya`}
                . Meta menolak review tanpa contoh nilai.
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || disabled}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

const SUGGESTIONS = ["name", "phone", "email", "company"];

function VariableSuggestions({
  onPick,
  disabled,
}: {
  onPick: (name: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Variabel umum:</span>
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-xs font-mono hover:bg-zinc-50 disabled:opacity-40"
        >
          {`{{${s}}}`}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const name = prompt("Nama variabel custom (huruf/angka/underscore):");
          if (!name) return;
          if (!/^[a-zA-Z0-9_]+$/.test(name)) {
            alert("Nama variabel hanya boleh huruf/angka/underscore.");
            return;
          }
          onPick(name);
        }}
        className="rounded-md border border-dashed border-zinc-300 px-2 py-0.5 text-xs hover:border-zinc-500 disabled:opacity-40"
      >
        + custom
      </button>
    </div>
  );
}

function ButtonBuilder({
  buttons,
  onChange,
  disabled,
}: {
  buttons: TemplateButton[];
  onChange: (b: TemplateButton[]) => void;
  disabled?: boolean;
}) {
  const canAdd = buttons.length < 3;
  return (
    <div className="space-y-2">
      <Label>Reply buttons (max 3)</Label>
      <div className="space-y-2">
        {buttons.map((b, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-2 rounded-lg border border-border bg-zinc-50/40 p-2"
          >
            <Select
              className="col-span-3 h-8 text-xs"
              disabled={disabled}
              value={b.type}
              onChange={(e) => {
                const next = [...buttons];
                if (e.target.value === "reply") {
                  next[i] = { type: "reply", text: b.text };
                } else if (e.target.value === "url") {
                  next[i] = {
                    type: "url",
                    text: b.text,
                    url: (b as { url?: string }).url ?? "",
                  };
                } else {
                  next[i] = {
                    type: "phone",
                    text: b.text,
                    phone: (b as { phone?: string }).phone ?? "",
                  };
                }
                onChange(next);
              }}
            >
              <option value="reply">reply</option>
              <option value="url">url</option>
              <option value="phone">phone</option>
            </Select>
            <Input
              className="col-span-4 h-8 text-xs"
              placeholder="text"
              disabled={disabled}
              value={b.text}
              onChange={(e) => {
                const next = [...buttons];
                next[i] = { ...b, text: e.target.value } as TemplateButton;
                onChange(next);
              }}
            />
            {b.type !== "reply" && (
              <Input
                className="col-span-4 h-8 text-xs"
                placeholder={b.type === "url" ? "https://…" : "+62…"}
                disabled={disabled}
                value={b.type === "url" ? b.url : b.phone}
                onChange={(e) => {
                  const next = [...buttons];
                  if (b.type === "url") {
                    next[i] = { ...b, url: e.target.value };
                  } else {
                    next[i] = { ...b, phone: e.target.value };
                  }
                  onChange(next);
                }}
              />
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(buttons.filter((_, j) => j !== i))}
              className="col-span-1 flex h-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      {canAdd && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...buttons, { type: "reply", text: "" }])}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-zinc-300 px-2.5 py-1 text-xs text-muted-foreground hover:border-zinc-500 hover:text-zinc-700"
        >
          <Plus className="h-3 w-3" /> Tambah button
        </button>
      )}
    </div>
  );
}

/** Live preview pane. Renders body with sample values substituted. */
export function TemplatePreview({
  values,
  variables,
}: {
  values: Pick<TemplateEditorValues, "body" | "footer" | "buttons">;
  variables: TemplateVariable[] | { name: string; sample_value?: string }[];
}) {
  const rendered = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of variables) {
      map.set(v.name, (v as { sample_value?: string }).sample_value ?? "");
    }
    return values.body.replace(
      /{{\s*([a-zA-Z0-9_]+)\s*}}/g,
      (_match, key) => map.get(key) || `{{${key}}}`,
    );
  }, [values.body, variables]);

  return (
    <div className="rounded-2xl bg-emerald-50 p-3">
      <div className="rounded-xl bg-white p-3 shadow-sm">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {rendered || (
            <span className="text-muted-foreground">(preview body)</span>
          )}
        </p>
        {values.footer && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {values.footer}
          </p>
        )}
        {values.buttons.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-zinc-100 pt-2">
            {values.buttons.map((b, i) => (
              <button
                key={i}
                disabled
                className="block w-full rounded-md border border-zinc-200 bg-white py-1 text-center text-xs font-medium text-sky-600"
              >
                {b.text || "(button)"}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
