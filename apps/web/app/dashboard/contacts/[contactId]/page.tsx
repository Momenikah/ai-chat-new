"use client";

import { useState } from "react";
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
  Building2,
  Cake,
  Edit2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Trash2,
  X,
} from "lucide-react";
import { api, ApiException } from "@/lib/api";
import { formatRelativeTime, initials } from "@/lib/utils";
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
  ContactForm,
  type ContactFormValues,
} from "@/components/contacts/contact-form";
import { TagEditor } from "@/components/contacts/tag-editor";
import { ContactTimeline } from "@/components/contacts/contact-timeline";
import { CHANNEL_META } from "@/components/channels/channel-meta";

export default function ContactDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { contactId } = useParams<{ contactId: string }>();
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const [editing, setEditing] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["contact", contactId],
    queryFn: () => api.contacts.get(contactId),
  });

  const tagsQuery = useQuery({
    queryKey: ["tags", workspaceId],
    queryFn: () => api.tags.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const updateMutation = useMutation({
    mutationFn: (values: ContactFormValues) =>
      api.contacts.update(contactId, {
        name: values.name,
        phone: values.phone || null,
        email: values.email || null,
        location: values.location || null,
        company: values.company || null,
        birthday: values.birthday || null,
        notes: values.notes || null,
      }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["contact", contactId] });
      queryClient.invalidateQueries({ queryKey: ["contacts", workspaceId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.contacts.remove(contactId),
    onSuccess: () => router.push("/dashboard/contacts"),
  });

  const attachMutation = useMutation({
    mutationFn: (tagId: string) => api.contacts.attachTag(contactId, tagId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["contact", contactId] }),
  });

  const detachMutation = useMutation({
    mutationFn: (tagId: string) => api.contacts.detachTag(contactId, tagId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["contact", contactId] }),
  });

  const error =
    updateMutation.error instanceof ApiException
      ? updateMutation.error.message
      : null;

  if (detailQuery.isLoading || !detailQuery.data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const { contact, tags, activities, messages } = detailQuery.data;
  const meta = contact.external_source ? CHANNEL_META[contact.external_source] : null;
  const Icon = meta?.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-4xl space-y-6"
    >
      <Link
        href="/dashboard/contacts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke kontak
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile */}
        <Card className="lg:col-span-1">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-lg font-semibold text-white">
                {initials(contact.name)}
              </div>
              <div>
                <p className="text-base font-semibold">{contact.name}</p>
                {contact.company && (
                  <p className="text-xs text-muted-foreground">
                    {contact.company}
                  </p>
                )}
              </div>
              {meta && Icon && (
                <Badge variant="secondary" className="gap-1">
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </Badge>
              )}
            </div>

            <div className="space-y-1.5 border-t border-border pt-4 text-sm">
              <Row icon={Phone} value={contact.phone} />
              <Row icon={Mail} value={contact.email} />
              <Row icon={MapPin} value={contact.location} />
              <Row icon={Building2} value={contact.company} />
              <Row
                icon={Cake}
                value={
                  contact.birthday ? contact.birthday.slice(0, 10) : null
                }
              />
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Tags
              </p>
              <TagEditor
                attached={tags}
                available={tagsQuery.data?.tags ?? []}
                onAttach={(id) => attachMutation.mutate(id)}
                onDetach={(id) => detachMutation.mutate(id)}
              />
            </div>

            <div className="flex gap-2 border-t border-border pt-4">
              {editing ? (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditing(false)}
                >
                  <X className="h-4 w-4" /> Batal edit
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditing(true)}
                >
                  <Edit2 className="h-4 w-4" /> Edit
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-red-600 hover:bg-red-50 hover:text-red-600"
                onClick={() => {
                  if (confirm(`Hapus kontak "${contact.name}"?`)) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Dibuat {formatRelativeTime(contact.created_at)}
            </p>
          </CardContent>
        </Card>

        {/* Edit form / Timeline */}
        <div className="space-y-6 lg:col-span-2">
          {editing ? (
            <Card>
              <CardHeader>
                <CardTitle>Edit kontak</CardTitle>
                <CardDescription>
                  Ubah detail dan klik simpan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContactForm
                  initial={{
                    name: contact.name,
                    phone: contact.phone ?? "",
                    email: contact.email ?? "",
                    location: contact.location ?? "",
                    company: contact.company ?? "",
                    birthday: contact.birthday
                      ? contact.birthday.slice(0, 10)
                      : "",
                    notes: contact.notes ?? "",
                  }}
                  submitting={updateMutation.isPending}
                  submitLabel="Simpan perubahan"
                  error={error}
                  onCancel={() => setEditing(false)}
                  onSubmit={(v) => updateMutation.mutate(v)}
                />
              </CardContent>
            </Card>
          ) : (
            contact.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Catatan</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm">{contact.notes}</p>
                </CardContent>
              </Card>
            )
          )}

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>
                Riwayat pesan dan aktivitas kontak.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContactTimeline activities={activities} messages={messages} />
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

function Row({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <p className="flex items-center gap-2 text-sm">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="truncate">{value}</span>
    </p>
  );
}
