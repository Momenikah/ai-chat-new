"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  LANGS,
  snippet,
  type EndpointSpec,
  type Lang,
} from "@/components/api-docs/endpoint-spec";
import { cn } from "@/lib/utils";

export function CodeTabs({
  endpoint,
  apiKey,
  lang,
  onLangChange,
}: {
  endpoint: EndpointSpec;
  apiKey: string;
  /** Shared selected language so all endpoints switch together. */
  lang: Lang;
  onLangChange: (lang: Lang) => void;
}) {
  const [copied, setCopied] = useState(false);
  const code = snippet(endpoint, lang, apiKey);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1.5">
        <div className="flex gap-1">
          {LANGS.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => onLangChange(l.key)}
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                lang === l.key
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copy}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Copy"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
