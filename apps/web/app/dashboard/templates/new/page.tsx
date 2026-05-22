"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, Sparkles } from "lucide-react";
import type { TemplateButton } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  EMPTY_TEMPLATE,
  TemplateEditor,
  TemplatePreview,
  type TemplateEditorValues,
} from "@/components/templates/template-editor";
import { findStarter } from "@/components/templates/template-starters";

export default function NewTemplatePage() {
  const router = useRouter();
  const params = useSearchParams();
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const [values, setValues] = useState<TemplateEditorValues>(EMPTY_TEMPLATE);
  const [source, setSource] = useState<"blank" | "starter" | "duplicate">(
    "blank",
  );

  const starterKey = params.get("starter");
  const fromId = params.get("from");

  /* ----------------------- Prefill (starter or from) ------------------- */

  const fromQuery = useQuery({
    queryKey: ["template", workspaceId, fromId],
    queryFn: () => api.templates.get(workspaceId as string, fromId as string),
    enabled: Boolean(workspaceId && fromId),
  });

  // Apply ?starter on mount.
  useEffect(() => {
    if (fromId || !starterKey) return;
    const preset = findStarter(starterKey);
    if (preset) {
      setValues(preset.values);
      setSource("starter");
    }
  }, [starterKey, fromId]);

  // Apply ?from when the source template arrives.
  useEffect(() => {
    if (!fromQuery.data) return;
    const t = fromQuery.data;
    setValues({
      name: `${t.name}_copy`,
      category: t.category,
      language: t.language,
      body: t.body,
      footer: t.footer ?? "",
      buttons: (t.buttons as TemplateButton[]) ?? [],
      variables: t.variables.map((v) => ({
        name: v.name,
        label: v.label ?? undefined,
        sample_value: v.sample_value ?? undefined,
      })),
    });
    setSource("duplicate");
  }, [fromQuery.data]);

  const mutation = useMutation({
    mutationFn: () =>
      api.templates.create(workspaceId as string, {
        name: values.name,
        category: values.category,
        language: values.language,
        body: values.body,
        footer: values.footer || undefined,
        buttons: values.buttons,
        variables: values.variables.map((v) => ({
          name: v.name,
          label: v.label,
          sample_value: v.sample_value,
        })),
      }),
    onSuccess: (t) => router.push(`/dashboard/templates/${t.id}`),
  });

  const error =
    mutation.error instanceof ApiException ? mutation.error.message : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-5xl space-y-6"
    >
      <div>
        <Link
          href="/dashboard/templates"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke template
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {source === "duplicate"
              ? "Duplicate template"
              : source === "starter"
                ? "Template baru (starter)"
                : "Template baru"}
          </h1>
          {source === "starter" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
              <Sparkles className="h-3 w-3" /> preset
            </span>
          )}
        </div>
        {source === "duplicate" && (
          <p className="mt-1 text-xs text-muted-foreground">
            Pre-filled dari template yang ada. Wajib pakai nama berbeda dari
            template asli.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Editor</CardTitle>
            <CardDescription>
              Template disimpan sebagai <code>draft</code>; klik{" "}
              <em>Submit ke Meta</em> di halaman detail untuk approve.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateEditor
              values={values}
              onChange={setValues}
              submitting={mutation.isPending}
              onSubmit={() => mutation.mutate()}
              submitLabel="Simpan template"
              error={error}
            />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Preview
          </p>
          <TemplatePreview values={values} variables={values.variables} />
        </div>
      </div>
    </motion.div>
  );
}
