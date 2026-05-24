"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Code2, Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ENDPOINTS,
  PUBLIC_BASE,
  type EndpointSpec,
  type Lang,
} from "@/components/api-docs/endpoint-spec";
import { CodeTabs } from "@/components/api-docs/code-tabs";
import { TryIt } from "@/components/api-docs/try-it";
import { EndpointNav } from "@/components/api-docs/endpoint-nav";

export default function APIDocsPage() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [lang, setLang] = useState<Lang>("curl");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-5xl"
    >
      <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
        <div className="hidden lg:block">
          <EndpointNav />
        </div>

        <div className="min-w-0 space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                API Documentation
              </h1>
              <p className="text-sm text-muted-foreground">
                Public REST API untuk integrasi. Autentikasi pakai API key
                sebagai Bearer token.
              </p>
            </div>
          </div>

          {/* Auth + key input */}
          <Card className="space-y-3 p-4">
            <h2 className="font-semibold">Autentikasi</h2>
            <p className="text-sm text-muted-foreground">
              Sertakan API key di header tiap request. Workspace otomatis
              dikenali dari key — tidak perlu workspace id di URL.
            </p>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                <KeyRound className="h-3.5 w-3.5" />
                API key Anda (disisipkan ke snippet & Try-it, tidak disimpan)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="aic_xxxxxxxxxxxx"
                  className="h-9 flex-1 rounded-lg border border-input bg-zinc-50 px-3 font-mono text-xs outline-none focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                  aria-label={showKey ? "Sembunyikan" : "Lihat"}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Hanya disimpan di memori browser untuk sesi ini. Buat key di
                halaman API Keys.
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              Base URL:{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">
                {PUBLIC_BASE}
              </code>
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">
                Rate limit per key (default 120/menit)
              </Badge>
              <Badge variant="secondary">
                Setiap request dicatat di API usage log
              </Badge>
            </div>
          </Card>

          {/* Endpoints */}
          <div className="space-y-3">
            <h2 className="font-semibold">Endpoints</h2>
            {ENDPOINTS.map((ep) => (
              <EndpointCard
                key={ep.id}
                endpoint={ep}
                apiKey={apiKey}
                lang={lang}
                onLangChange={setLang}
              />
            ))}
          </div>

          {/* Error format */}
          <Card className="space-y-2 p-4">
            <h2 className="font-semibold">Error format</h2>
            <p className="text-sm text-muted-foreground">
              Semua error memakai bentuk yang konsisten:
            </p>
            <StaticCode
              code={`{
  "error": "rate_limited",
  "message": "Batas rate limit API terlampaui, coba lagi nanti"
}`}
            />
            <p className="text-xs text-muted-foreground">
              Kode status umum: 401 (key tidak valid), 403 (resource bukan milik
              workspace), 422 (validasi), 429 (rate limit).
            </p>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

function EndpointCard({
  endpoint,
  apiKey,
  lang,
  onLangChange,
}: {
  endpoint: EndpointSpec;
  apiKey: string;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
}) {
  return (
    <Card id={endpoint.id} className="scroll-mt-6 space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Badge variant={endpoint.method === "GET" ? "secondary" : "default"}>
          {endpoint.method}
        </Badge>
        <code className="font-mono text-sm">{endpoint.path}</code>
        {endpoint.tryable && (
          <Badge variant="outline" className="ml-auto text-[10px]">
            try-it
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{endpoint.desc}</p>

      {endpoint.query && endpoint.query.length > 0 && (
        <div className="rounded-lg border border-border">
          <p className="border-b border-border bg-zinc-50/60 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Query params
          </p>
          <ul className="divide-y divide-border">
            {endpoint.query.map((q) => (
              <li key={q.name} className="flex gap-2 px-3 py-1.5 text-xs">
                <code className="shrink-0 font-mono text-zinc-900">{q.name}</code>
                <span className="text-muted-foreground">{q.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CodeTabs
        endpoint={endpoint}
        apiKey={apiKey}
        lang={lang}
        onLangChange={onLangChange}
      />

      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-zinc-700">
          Contoh response (200)
        </summary>
        <StaticCode code={endpoint.response} className="mt-2" />
      </details>

      {endpoint.tryable ? (
        <TryIt endpoint={endpoint} apiKey={apiKey} />
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Try-it dinonaktifkan untuk endpoint yang mengubah data — uji lewat
          snippet di lingkungan Anda.
        </p>
      )}
    </Card>
  );
}

function StaticCode({
  code,
  className,
}: {
  code: string;
  className?: string;
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
  return (
    <div className={`relative ${className ?? ""}`}>
      <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-100">
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute right-2 top-2 rounded-md bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700"
        aria-label="Copy"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
