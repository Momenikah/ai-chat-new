"use client";

import { ExternalLink, ImageIcon, List as ListIcon } from "lucide-react";
import type {
  CarouselPayload,
  InteractiveKind,
  InteractivePayload,
  ListPayload,
  ReplyButtonsPayload,
} from "@aichat/shared";

/** WhatsApp-style chat bubble preview for an interactive payload. */
export function InteractivePreview({
  kind,
  payload,
}: {
  kind: InteractiveKind;
  payload: InteractivePayload;
}) {
  return (
    <div className="rounded-2xl bg-emerald-50 p-3">
      <div className="mx-auto max-w-[280px] space-y-2">
        {kind === "reply_buttons" && (
          <ReplyButtonsBubble payload={payload as ReplyButtonsPayload} />
        )}
        {kind === "list" && <ListBubble payload={payload as ListPayload} />}
        {kind === "carousel" && (
          <CarouselBubble payload={payload as CarouselPayload} />
        )}
      </div>
    </div>
  );
}

function ReplyButtonsBubble({ payload }: { payload: ReplyButtonsPayload }) {
  return (
    <div className="overflow-hidden rounded-xl rounded-tl-sm bg-white shadow-sm">
      <p className="whitespace-pre-wrap px-3 py-2.5 text-sm">
        {payload.body || (
          <span className="text-muted-foreground">(body kosong)</span>
        )}
      </p>
      <div className="space-y-1 border-t border-zinc-100 p-1.5">
        {(payload.buttons ?? []).map((b, i) => (
          <div
            key={b.id || i}
            className="rounded-md bg-zinc-50 py-1.5 text-center text-xs font-medium text-sky-600"
          >
            {b.title || "(button)"}
          </div>
        ))}
        {(payload.buttons ?? []).length === 0 && (
          <p className="py-1 text-center text-[11px] text-muted-foreground">
            belum ada button
          </p>
        )}
      </div>
    </div>
  );
}

function ListBubble({ payload }: { payload: ListPayload }) {
  return (
    <div className="overflow-hidden rounded-xl rounded-tl-sm bg-white shadow-sm">
      <p className="whitespace-pre-wrap px-3 py-2.5 text-sm">
        {payload.body || (
          <span className="text-muted-foreground">(body kosong)</span>
        )}
      </p>
      <div className="border-t border-zinc-100 p-1.5">
        <div className="flex items-center justify-center gap-1.5 rounded-md bg-zinc-50 py-1.5 text-xs font-medium text-sky-600">
          <ListIcon className="h-3.5 w-3.5" />
          {payload.button_text || "Pilih"}
        </div>
      </div>
      <div className="space-y-2 border-t border-zinc-100 px-3 py-2">
        {(payload.sections ?? []).map((s, si) => (
          <div key={si}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {s.title || `Section ${si + 1}`}
            </p>
            <ul className="mt-1 space-y-1">
              {(s.rows ?? []).map((r, ri) => (
                <li key={r.id || ri} className="rounded-md bg-zinc-50 px-2 py-1">
                  <p className="text-xs font-medium">{r.title || "(row)"}</p>
                  {r.description && (
                    <p className="text-[10px] text-muted-foreground">
                      {r.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function CarouselBubble({ payload }: { payload: CarouselPayload }) {
  const cards = payload.cards ?? [];
  if (cards.length === 0) {
    return (
      <div className="rounded-xl bg-white p-4 text-center text-xs text-muted-foreground shadow-sm">
        belum ada kartu
      </div>
    );
  }
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {cards.map((c, i) => (
        <div
          key={i}
          className="w-40 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm"
        >
          <div className="flex h-20 items-center justify-center bg-zinc-100">
            {c.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.image_url}
                alt={c.title}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <ImageIcon className="h-5 w-5 text-zinc-400" />
            )}
          </div>
          <div className="space-y-0.5 p-2">
            <p className="truncate text-xs font-medium">
              {c.title || "(judul)"}
            </p>
            {c.subtitle && (
              <p className="line-clamp-2 text-[10px] text-muted-foreground">
                {c.subtitle}
              </p>
            )}
            {c.button && (
              <div className="mt-1 flex items-center justify-center gap-1 rounded-md bg-zinc-50 py-1 text-[10px] font-medium text-sky-600">
                {c.button.type === "url" && <ExternalLink className="h-2.5 w-2.5" />}
                {c.button.text || "(button)"}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
