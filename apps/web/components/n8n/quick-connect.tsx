"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, Plus, Zap } from "lucide-react";
import { WEBHOOK_EVENTS } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Sensible defaults for an n8n inbound automation.
const DEFAULT_EVENTS = ["message.received"];

export function QuickConnect({
  workspaceId,
  onCreated,
}: {
  workspaceId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("n8n workflow");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(DEFAULT_EVENTS);

  const mutation = useMutation({
    mutationFn: () =>
      api.webhooks.create(workspaceId, { name, url, events, enabled: true }),
    onSuccess: () => {
      onCreated();
      setUrl("");
      setEvents(DEFAULT_EVENTS);
      setName("n8n workflow");
    },
  });

  const err = mutation.error instanceof ApiException ? mutation.error.message : null;
  const toggle = (e: string) =>
    setEvents((cur) =>
      cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e],
    );

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <Zap className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-semibold">Quick-connect endpoint</h2>
          <p className="text-sm text-muted-foreground">
            Tempel Production URL dari node Webhook n8n untuk langsung daftar.
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="qc-name" className="text-xs">
              Nama
            </Label>
            <Input
              id="qc-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-url" className="text-xs">
              n8n Production URL
            </Label>
            <Input
              id="qc-url"
              type="url"
              required
              placeholder="https://n8n.example.com/webhook/aichat"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Event yang dikirim ke n8n</Label>
          <div className="flex flex-wrap gap-1.5">
            {WEBHOOK_EVENTS.map((e) => {
              const on = events.includes(e);
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => toggle(e)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors",
                    on
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
                  )}
                >
                  {on && <Check className="h-3 w-3" />}
                  {e}
                </button>
              );
            })}
          </div>
        </div>

        {err && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {err}
          </p>
        )}
        {mutation.isSuccess && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Endpoint dibuat. Klik Test di bawah untuk kirim payload contoh.
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending || events.length === 0}>
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Hubungkan
          </Button>
        </div>
      </form>
    </Card>
  );
}
