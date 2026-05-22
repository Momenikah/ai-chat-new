"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const BRAND_PRESETS = [
  "#18181b",
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
];

export function ColorPresets({
  value,
  onPick,
  disabled,
}: {
  value: string;
  onPick: (hex: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {BRAND_PRESETS.map((c) => {
        const active = value.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => onPick(c)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 transition-all disabled:cursor-not-allowed",
              active ? "ring-2 ring-zinc-900" : "hover:scale-110",
            )}
            style={{ background: c }}
            aria-label={`Pilih warna ${c}`}
          >
            {active && <Check className="h-3.5 w-3.5 text-white" />}
          </button>
        );
      })}
    </div>
  );
}

export function BrandingPreview({
  name,
  logoUrl,
  brandColor,
}: {
  name: string;
  logoUrl: string;
  brandColor: string;
}) {
  const [imgOk, setImgOk] = useState(true);
  const initial = (name.trim()[0] ?? "W").toUpperCase();
  const showLogo = logoUrl.trim().length > 0 && imgOk;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        Preview
      </p>
      <Card className="overflow-hidden">
        {/* Brand header band */}
        <div className="h-16 w-full" style={{ background: brandColor }} />
        <div className="-mt-8 px-5 pb-5">
          <span
            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-white text-xl font-semibold text-white shadow-sm"
            style={{ background: brandColor }}
          >
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={name}
                className="h-full w-full object-cover"
                onError={() => setImgOk(false)}
                onLoad={() => setImgOk(true)}
              />
            ) : (
              initial
            )}
          </span>
          <p className="mt-3 truncate text-base font-semibold">
            {name.trim() || "Nama workspace"}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
              style={{ background: brandColor }}
            >
              Tombol utama
            </button>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: `${brandColor}1a`, color: brandColor }}
            >
              Badge brand
            </span>
          </div>
        </div>
      </Card>
      {logoUrl.trim().length > 0 && !imgOk && (
        <p className="text-xs text-amber-600">
          URL logo tidak bisa dimuat — periksa kembali tautannya.
        </p>
      )}
    </div>
  );
}
