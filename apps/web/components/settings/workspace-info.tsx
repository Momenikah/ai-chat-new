"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Workspace } from "@aichat/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function WorkspaceInfo({ workspace }: { workspace: Workspace }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Info workspace</CardTitle>
        <CardDescription>Referensi teknis (read-only).</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border text-sm">
          <Row label="Workspace ID" value={workspace.id} mono copyable />
          <Row label="Slug" value={`/${workspace.slug}`} mono />
          <Row
            label="Dibuat"
            value={new Date(workspace.created_at).toLocaleString("id-ID")}
          />
          <Row
            label="Terakhir diperbarui"
            value={new Date(workspace.updated_at).toLocaleString("id-ID")}
          />
          {workspace.owner_id && (
            <Row label="Owner ID" value={workspace.owner_id} mono copyable />
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd
        className={`flex min-w-0 items-center gap-1.5 ${mono ? "font-mono text-xs" : ""}`}
      >
        <span className="truncate">{value}</span>
        {copyable && (
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Salin"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        )}
      </dd>
    </div>
  );
}
