"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
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
  ContactForm,
  type ContactFormValues,
} from "@/components/contacts/contact-form";

export default function NewContactPage() {
  const router = useRouter();
  const workspaceId = useWorkspaceStore((s) => s.currentId);

  const mutation = useMutation({
    mutationFn: (values: ContactFormValues) =>
      api.contacts.create(workspaceId as string, {
        name: values.name,
        phone: values.phone || null,
        email: values.email || null,
        location: values.location || null,
        company: values.company || null,
        birthday: values.birthday || null,
        notes: values.notes || null,
      }),
    onSuccess: (contact) => router.push(`/dashboard/contacts/${contact.id}`),
  });

  const error =
    mutation.error instanceof ApiException ? mutation.error.message : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-2xl space-y-6"
    >
      <div>
        <Link
          href="/dashboard/contacts"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke kontak
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Kontak baru</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detail kontak</CardTitle>
          <CardDescription>
            Field yang tidak diisi dapat dilengkapi belakangan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContactForm
            submitting={mutation.isPending}
            submitLabel="Tambah kontak"
            error={error}
            onCancel={() => router.push("/dashboard/contacts")}
            onSubmit={(values) => mutation.mutate(values)}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}
