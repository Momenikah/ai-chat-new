"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ExternalLink, Loader2, Send, Workflow } from "lucide-react";
import { api, ApiException } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { N8nStatus } from "@/components/n8n/n8n-status";
import { QuickConnect } from "@/components/n8n/quick-connect";
import { PayloadExplorer } from "@/components/n8n/payload-explorer";
import { RecipeGallery } from "@/components/n8n/recipe-gallery";
import { CodeBlock } from "@/components/n8n/code-block";

const SIGNATURE_SNIPPET = `// n8n Function node — verify HMAC before trusting the payload
const crypto = require('crypto');
const secret = 'whsec_xxx'; // dari endpoint webhook Anda
const signature = $headers['x-aichat-signature'];
const body = JSON.stringify($json);
const expected = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('hex');
if (signature !== expected) {
  throw new Error('Invalid signature');
}
return items;`;

export default function N8nPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const { data, isLoading } = useQuery({
    queryKey: ["webhooks", workspaceId],
    queryFn: () => api.webhooks.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const endpoints = data?.endpoints ?? [];
  const [selected, setSelected] = useState<string>("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["webhooks", workspaceId] });

  const test = useMutation({
    mutationFn: (id: string) => api.webhooks.test(id),
  });

  const testErr = test.error instanceof ApiException ? test.error.message : null;
  const activeId = selected || endpoints[0]?.id || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
          <Workflow className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">n8n Integration</h1>
          <p className="text-sm text-muted-foreground">
            Hubungkan AI Chat ke ribuan app lewat n8n menggunakan webhook.
          </p>
        </div>
      </div>

      <N8nStatus endpoints={endpoints} loading={isLoading} />

      {workspaceId && (
        <QuickConnect workspaceId={workspaceId} onCreated={invalidate} />
      )}

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Test webhook</h2>
        {endpoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada endpoint webhook. Gunakan Quick-connect di atas atau buka{" "}
            <a
              href="/dashboard/developer/webhooks"
              className="inline-flex items-center gap-1 text-zinc-900 underline"
            >
              Webhooks <ExternalLink className="h-3 w-3" />
            </a>
            .
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Endpoint</label>
              <Select
                value={activeId}
                onChange={(e) => setSelected(e.target.value)}
              >
                {endpoints.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.name} — {ep.url}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              onClick={() => activeId && test.mutate(activeId)}
              disabled={test.isPending || !activeId}
            >
              {test.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Kirim test
            </Button>
          </div>
        )}
        {test.isSuccess && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Payload test dikirim ke antrean. Cek log pengiriman di menu Webhooks
            atau eksekusi n8n Anda.
          </p>
        )}
        {testErr && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {testErr}
          </p>
        )}
      </Card>

      <PayloadExplorer />

      <RecipeGallery />

      <Card className="space-y-2 p-4">
        <h2 className="font-semibold">Verifikasi signature (opsional)</h2>
        <p className="text-sm text-muted-foreground">
          Tambahkan Function node di n8n untuk memvalidasi HMAC sebelum memproses
          payload.
        </p>
        <CodeBlock code={SIGNATURE_SNIPPET} />
      </Card>
    </motion.div>
  );
}
