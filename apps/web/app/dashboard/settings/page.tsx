"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { api, ApiException } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BrandingPreview,
  ColorPresets,
} from "@/components/settings/branding-preview";
import { WorkspaceInfo } from "@/components/settings/workspace-info";
import { SettingsQuickLinks } from "@/components/settings/settings-quick-links";
import { DangerZone } from "@/components/settings/danger-zone";

const TIMEZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Pontianak",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Bangkok",
  "Asia/Manila",
  "Asia/Tokyo",
  "Asia/Dubai",
  "Australia/Sydney",
  "Europe/London",
  "America/New_York",
  "UTC",
];

export default function WorkspaceSettingsPage() {
  const queryClient = useQueryClient();
  const currentId = useWorkspaceStore((s) => s.currentId);
  const can = useWorkspaceStore((s) => s.can);
  const editable = can("ADMIN");
  const isOwner = can("OWNER");

  const { data, isLoading } = useQuery({
    queryKey: ["workspace", currentId],
    queryFn: () => api.workspaces.get(currentId as string),
    enabled: Boolean(currentId),
  });

  const [form, setForm] = useState({
    name: "",
    brand_color: "#18181b",
    timezone: "Asia/Jakarta",
    logo_url: "",
  });

  useEffect(() => {
    if (data?.workspace) {
      setForm({
        name: data.workspace.name,
        brand_color: data.workspace.brand_color,
        timezone: data.workspace.timezone,
        logo_url: data.workspace.logo_url ?? "",
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      api.workspaces.update(currentId as string, {
        name: form.name,
        brand_color: form.brand_color,
        timezone: form.timezone,
        logo_url: form.logo_url.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", currentId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  const error =
    mutation.error instanceof ApiException ? mutation.error.message : null;

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-4xl space-y-6"
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Pengaturan Workspace
        </h1>
        <p className="text-sm text-muted-foreground">
          Branding dan preferensi untuk workspace ini.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader>
            <CardTitle>Branding bisnis</CardTitle>
            <CardDescription>
              Identitas yang muncul di dashboard dan undangan tim.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Nama bisnis</Label>
                <Input
                  id="name"
                  value={form.name}
                  disabled={!editable}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Slug workspace</Label>
                <Input value={data.workspace.slug} disabled readOnly />
                <p className="text-xs text-muted-foreground">
                  Slug bersifat permanen dan tidak dapat diubah.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand">Warna brand</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="brand"
                    type="color"
                    value={form.brand_color}
                    disabled={!editable}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, brand_color: e.target.value }))
                    }
                    className="h-9 w-14 cursor-pointer rounded-lg border border-input disabled:cursor-not-allowed"
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.brand_color}
                  </span>
                </div>
                <ColorPresets
                  value={form.brand_color}
                  disabled={!editable}
                  onPick={(hex) =>
                    setForm((f) => ({ ...f, brand_color: hex }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tz">Timezone</Label>
                <Select
                  id="tz"
                  value={form.timezone}
                  disabled={!editable}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, timezone: e.target.value }))
                  }
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo">URL logo</Label>
                <Input
                  id="logo"
                  placeholder="https://…/logo.png"
                  value={form.logo_url}
                  disabled={!editable}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, logo_url: e.target.value }))
                  }
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}
              {mutation.isSuccess && (
                <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <Check className="h-4 w-4" /> Perubahan tersimpan.
                </p>
              )}

              {editable ? (
                <div className="flex justify-end">
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Simpan perubahan
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Hanya ADMIN atau OWNER yang dapat mengubah pengaturan.
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <BrandingPreview
            name={form.name}
            logoUrl={form.logo_url}
            brandColor={form.brand_color}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Pintasan</h2>
        <SettingsQuickLinks />
      </div>

      <WorkspaceInfo workspace={data.workspace} />

      {isOwner && <DangerZone workspace={data.workspace} />}
    </motion.div>
  );
}
