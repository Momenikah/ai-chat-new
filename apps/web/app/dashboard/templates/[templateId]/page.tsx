"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Send,
  XCircle,
} from "lucide-react";
import type { TemplateButton, TemplateStatus } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TemplateEditor,
  TemplatePreview,
  type TemplateEditorValues,
} from "@/components/templates/template-editor";

const STATUS_META: Record<TemplateStatus, { variant: "success" | "warning" | "secondary" | "destructive"; icon: typeof CheckCircle2 }> = {
  draft: { variant: "secondary", icon: Clock },
  pending: { variant: "warning", icon: Clock },
  approved: { variant: "success", icon: CheckCircle2 },
  rejected: { variant: "destructive", icon: XCircle },
};

export default function TemplateDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { templateId } = useParams<{ templateId: string }>();
  const workspaceId = useWorkspaceStore((s) => s.currentId);

  const { data, isLoading } = useQuery({
    queryKey: ["template", workspaceId, templateId],
    queryFn: () => api.templates.get(workspaceId as string, templateId),
    enabled: Boolean(workspaceId && templateId),
  });

  const [values, setValues] = useState<TemplateEditorValues | null>(null);
  useEffect(() => {
    if (data) {
      setValues({
        name: data.name,
        category: data.category,
        language: data.language,
        body: data.body,
        footer: data.footer ?? "",
        buttons: (data.buttons as TemplateButton[]) ?? [],
        variables: data.variables.map((v) => ({
          name: v.name,
          label: v.label ?? undefined,
          sample_value: v.sample_value ?? undefined,
        })),
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      values
        ? api.templates.update(workspaceId as string, templateId, {
            name: values.name,
            category: values.category,
            language: values.language,
            body: values.body,
            footer: values.footer || undefined,
            buttons: values.buttons,
            variables: values.variables,
          })
        : Promise.reject(new Error("no values")),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["template", workspaceId, templateId],
      }),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.templates.submit(workspaceId as string, templateId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["template", workspaceId, templateId],
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.templates.remove(workspaceId as string, templateId),
    onSuccess: () => router.push("/dashboard/templates"),
  });

  if (isLoading || !data || !values) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const status = STATUS_META[data.status];
  const Icon = status.icon;
  const editable = data.status === "draft" || data.status === "rejected";

  const updateError =
    updateMutation.error instanceof ApiException
      ? updateMutation.error.message
      : null;
  const submitError =
    submitMutation.error instanceof ApiException
      ? submitMutation.error.message
      : null;

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
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{data.name}</h1>
          <Badge variant={status.variant} className="gap-1">
            <Icon className="h-3 w-3" />
            {data.status}
          </Badge>
          {data.external_id && (
            <span className="text-xs text-muted-foreground">
              · meta_id <code>{data.external_id}</code>
            </span>
          )}
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <Link href={`/dashboard/templates/new?from=${templateId}`}>
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </Link>
          </Button>
        </div>
        {data.rejection_reason && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            Ditolak: {data.rejection_reason}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>{editable ? "Editor" : "Detail (read-only)"}</CardTitle>
            <CardDescription>
              {editable
                ? "Edit lalu klik Submit untuk mengirim ke Meta."
                : "Template terkunci. Hanya draft/rejected yang bisa diedit."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateEditor
              values={values}
              onChange={setValues}
              submitting={updateMutation.isPending}
              onSubmit={() => updateMutation.mutate()}
              submitLabel="Simpan perubahan"
              error={updateError}
              disabled={!editable}
            />

            {editable && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                <Button
                  variant="outline"
                  className="text-red-600"
                  onClick={() => {
                    if (confirm(`Hapus template "${data.name}"?`)) {
                      deleteMutation.mutate();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Hapus
                </Button>
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Submit ke Meta
                </Button>
              </div>
            )}
            {submitError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {submitError}
              </p>
            )}
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
