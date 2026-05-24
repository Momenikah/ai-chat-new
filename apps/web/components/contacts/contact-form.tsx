"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ContactFormValues {
  name: string;
  phone: string;
  email: string;
  location: string;
  company: string;
  birthday: string;
  notes: string;
}

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  name: "",
  phone: "",
  email: "",
  location: "",
  company: "",
  birthday: "",
  notes: "",
};

export function ContactForm({
  initial,
  submitting,
  submitLabel = "Simpan",
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<ContactFormValues>;
  submitting?: boolean;
  submitLabel?: string;
  error?: string | null;
  onSubmit: (values: ContactFormValues) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<ContactFormValues>({
    ...EMPTY_CONTACT_FORM,
    ...initial,
  });

  const set =
    (key: keyof ContactFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="name">Nama lengkap</Label>
        <Input id="name" required value={form.name} onChange={set("name")} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Telepon</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+628…"
            value={form.phone}
            onChange={set("phone")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="nama@perusahaan.com"
            value={form.email}
            onChange={set("email")}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location">Lokasi</Label>
          <Input
            id="location"
            placeholder="Jakarta"
            value={form.location}
            onChange={set("location")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Perusahaan</Label>
          <Input
            id="company"
            placeholder="PT Maju Jaya"
            value={form.company}
            onChange={set("company")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthday">Ulang tahun</Label>
        <Input
          id="birthday"
          type="date"
          value={form.birthday}
          onChange={set("birthday")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Catatan</Label>
        <textarea
          id="notes"
          rows={3}
          value={form.notes}
          onChange={set("notes")}
          placeholder="Preferensi, info tambahan…"
          className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Batal
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
