"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  ArrowLeft,
  CheckCircle2,
  FileUp,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import type { ContactImportResult } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const TEMPLATE = `name,phone,email,location,company,birthday,notes
Budi Santoso,+6281200001111,budi@contoh.com,Jakarta,PT Maju Jaya,1990-04-21,VIP customer
Siti Aminah,+6281200002222,siti@contoh.com,Bandung,,1992-11-08,Lead dari pameran`;

export default function ContactImportPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.currentId);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [result, setResult] = useState<ContactImportResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.contacts.importCSV(workspaceId as string, file!),
    onSuccess: (r) => {
      setResult(r);
      queryClient.invalidateQueries({ queryKey: ["contacts", workspaceId] });
    },
  });

  async function handleFile(f: File) {
    setFile(f);
    setResult(null);
    const text = await f.text();
    setPreview(parseCsvPreview(text, 10));
  }

  const error =
    mutation.error instanceof ApiException ? mutation.error.message : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <div>
        <Link
          href="/dashboard/contacts"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke kontak
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          Import kontak dari CSV
        </h1>
        <p className="text-sm text-muted-foreground">
          File CSV harus memiliki kolom <code>name</code>. Kolom lain yang
          dikenali: <code>phone, email, location, company, birthday, notes</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pilih file</CardTitle>
          <CardDescription>
            Maksimal 5MB. Format <code>.csv</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50/50 px-4 py-8 text-center transition-colors hover:border-zinc-400"
          >
            <FileUp className="h-6 w-6 text-zinc-500" />
            <p className="text-sm font-medium">
              {file ? file.name : "Klik untuk pilih file CSV"}
            </p>
            {file && (
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Lihat contoh CSV</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-[11px] text-zinc-100">
              {TEMPLATE}
            </pre>
          </details>
        </CardContent>
      </Card>

      {preview.length > 0 && !result && (
        <Card>
          <CardHeader>
            <CardTitle>Preview ({preview.length - 1} baris pertama)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 text-left">
                  <tr>
                    {preview[0].map((h, i) => (
                      <th key={i} className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.slice(1).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="px-3 py-1.5 text-muted-foreground"
                        >
                          {cell || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFile(null)}>
                Ganti file
              </Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={!file || mutation.isPending}
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Import sekarang
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" /> Import selesai
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Dibuat" value={result.created} accent="emerald" />
              <Stat label="Diperbarui" value={result.updated} accent="sky" />
              <Stat label="Dilewati" value={result.skipped} accent="zinc" />
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <div className="mb-1 flex items-center gap-1 font-medium">
                  <XCircle className="h-3.5 w-3.5" />
                  {result.errors.length} error
                </div>
                <ul className="list-disc space-y-0.5 pl-5">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setFile(null);
                  setPreview([]);
                }}
              >
                Import lagi
              </Button>
              <Button onClick={() => router.push("/dashboard/contacts")}>
                Lihat kontak
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "emerald" | "sky" | "zinc";
}) {
  const bg = {
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    zinc: "bg-zinc-100 text-zinc-700",
  }[accent];
  return (
    <div className={`rounded-lg ${bg} px-3 py-2.5`}>
      <p className="text-xs">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function parseCsvPreview(text: string, maxRows: number): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows = lines.slice(0, maxRows + 1).map((line) => splitCsv(line));
  return rows;
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        cur += ch;
      }
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else if (ch === '"') {
      inQuote = true;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
