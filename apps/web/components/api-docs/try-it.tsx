"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Play } from "lucide-react";
import { tryUrl, type EndpointSpec } from "@/components/api-docs/endpoint-spec";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface RunState {
  loading: boolean;
  status?: number;
  body?: string;
  error?: string;
}

export function TryIt({
  endpoint,
  apiKey,
}: {
  endpoint: EndpointSpec;
  apiKey: string;
}) {
  const [pathParam, setPathParam] = useState("");
  const [query, setQuery] = useState<Record<string, string>>({});
  const [state, setState] = useState<RunState>({ loading: false });

  async function run() {
    if (!apiKey.trim()) {
      setState({ loading: false, error: "Tempel API key dulu di atas." });
      return;
    }
    setState({ loading: true });
    const url = tryUrl(endpoint, { pathParam, query });
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
      });
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* keep raw text */
      }
      setState({ loading: false, status: res.status, body: pretty });
    } catch (e) {
      setState({
        loading: false,
        error: e instanceof Error ? e.message : "Request gagal (CORS/jaringan?)",
      });
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border bg-zinc-50/60 p-3">
      <div className="flex flex-wrap items-end gap-2">
        {endpoint.pathParam && (
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">
              {endpoint.pathParam.name}
            </span>
            <Input
              className="h-8 w-56 text-xs font-mono"
              placeholder={endpoint.pathParam.example}
              value={pathParam}
              onChange={(e) => setPathParam(e.target.value)}
            />
          </label>
        )}
        {endpoint.query?.map((q) => (
          <label key={q.name} className="space-y-1 text-xs">
            <span className="text-muted-foreground">{q.name}</span>
            <Input
              className="h-8 w-32 text-xs"
              placeholder={q.example}
              value={query[q.name] ?? ""}
              onChange={(e) =>
                setQuery((prev) => ({ ...prev, [q.name]: e.target.value }))
              }
            />
          </label>
        ))}
        <button
          type="button"
          onClick={run}
          disabled={state.loading}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {state.loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Kirim request
        </button>
      </div>

      <AnimatePresence>
        {(state.status !== undefined || state.error) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-1"
          >
            {state.error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {state.error}
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono font-medium",
                      (state.status ?? 0) < 400
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700",
                    )}
                  >
                    {state.status}
                  </span>
                  <span className="text-muted-foreground">Response</span>
                </div>
                <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-100">
                  <code>{state.body}</code>
                </pre>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
