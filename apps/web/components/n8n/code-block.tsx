"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";

export function CodeBlock({
  code,
  downloadName,
}: {
  code: string;
  /** When set, shows a download button that saves the code to this filename. */
  downloadName?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const download = () => {
    const blob = new Blob([code], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName as string;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative">
      <pre className="max-h-96 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-100">
        <code>{code}</code>
      </pre>
      <div className="absolute right-2 top-2 flex gap-1">
        {downloadName && (
          <button
            onClick={download}
            className="rounded-md bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700"
            aria-label="Download JSON"
            title="Download .json"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={copy}
          className="rounded-md bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700"
          aria-label="Copy"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
