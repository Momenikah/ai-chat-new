"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { isGatewayChannel, type Channel, type ChannelType } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CHANNEL_META } from "@/components/channels/channel-meta";

interface Field {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
  optional?: boolean;
}

const FIELDS: Record<ChannelType, Field[]> = {
  whatsapp: [
    { key: "phone_number_id", label: "Phone Number ID", placeholder: "1029384756" },
    {
      key: "business_account_id",
      label: "Business Account ID",
      placeholder: "5647382910",
      optional: true,
    },
    { key: "access_token", label: "Access Token", placeholder: "EAAG…", secret: true },
    {
      key: "webhook_verify_token",
      label: "Webhook Verify Token",
      placeholder: "opsional",
      optional: true,
    },
  ],
  instagram: [
    {
      key: "instagram_business_id",
      label: "Instagram Business ID",
      placeholder: "17841400000000000",
    },
    { key: "page_id", label: "Page ID", placeholder: "opsional", optional: true },
    {
      key: "page_access_token",
      label: "Page Access Token",
      placeholder: "IGQVJ…",
      secret: true,
    },
    {
      key: "webhook_verify_token",
      label: "Webhook Verify Token",
      placeholder: "opsional",
      optional: true,
    },
  ],
  messenger: [
    { key: "page_id", label: "Page ID", placeholder: "612345678901234" },
    {
      key: "page_access_token",
      label: "Page Access Token",
      placeholder: "EAAG…",
      secret: true,
    },
    {
      key: "webhook_verify_token",
      label: "Webhook Verify Token",
      placeholder: "opsional",
      optional: true,
    },
  ],
  onesender: [
    { key: "base_url", label: "URL instance OneSender", placeholder: "https://wa.domainanda.com" },
    { key: "api_key", label: "API Key", placeholder: "••••••••", secret: true },
  ],
  starsender: [
    { key: "api_key", label: "Device API Key", placeholder: "••••••••", secret: true },
  ],
};

export function ReconnectDialog({
  channel,
  open,
  onOpenChange,
  onDone,
}: {
  channel: Channel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const fields = FIELDS[channel.type];
  const [vals, setVals] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => {
      const v = (k: string) => vals[k]?.trim() ?? "";
      const ws = channel.workspace_id;
      if (channel.type === "whatsapp") {
        return api.whatsapp.connect(ws, {
          name: channel.name,
          phone_number_id: v("phone_number_id"),
          business_account_id: v("business_account_id") || undefined,
          access_token: v("access_token"),
          webhook_verify_token: v("webhook_verify_token") || undefined,
        });
      }
      if (channel.type === "instagram") {
        return api.instagram.connect(ws, {
          name: channel.name,
          instagram_business_id: v("instagram_business_id"),
          page_id: v("page_id") || undefined,
          page_access_token: v("page_access_token"),
          webhook_verify_token: v("webhook_verify_token") || undefined,
        });
      }
      if (isGatewayChannel(channel.type)) {
        // Re-keys this channel in place; the webhook URL is kept.
        return api.gateway.connect(ws, {
          provider: channel.type,
          channel_id: channel.id,
          name: channel.name,
          api_key: v("api_key"),
          base_url: v("base_url") || undefined,
          phone_number: channel.external_id ?? undefined,
        });
      }
      return api.messenger.connect(ws, {
        name: channel.name,
        page_id: v("page_id"),
        page_access_token: v("page_access_token"),
        webhook_verify_token: v("webhook_verify_token") || undefined,
      });
    },
    onSuccess: () => {
      onDone();
      onOpenChange(false);
      setVals({});
    },
  });

  const err = mutation.error instanceof ApiException ? mutation.error.message : null;
  const meta = CHANNEL_META[channel.type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Reconnect {channel.name}
          </DialogTitle>
          <DialogDescription>
            Masukkan ulang credential {meta.label}. Credential lama akan
            ditimpa & dienkripsi ulang.
          </DialogDescription>
        </DialogHeader>

        <form
          id="reconnect-form"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`rc-${f.key}`} className="text-xs">
                {f.label}
                {!f.optional && <span className="text-red-500"> *</span>}
              </Label>
              <Input
                id={`rc-${f.key}`}
                type={f.secret ? "password" : "text"}
                required={!f.optional}
                placeholder={f.placeholder}
                value={vals[f.key] ?? ""}
                onChange={(e) =>
                  setVals((prev) => ({ ...prev, [f.key]: e.target.value }))
                }
              />
            </div>
          ))}

          {err && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {err}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button
            type="submit"
            form="reconnect-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Reconnect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
