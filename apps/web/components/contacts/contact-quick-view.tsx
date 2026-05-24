"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  Building2,
  Cake,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  StickyNote,
  X,
} from "lucide-react";
import type { Contact } from "@aichat/shared";
import { api } from "@/lib/api";
import { initials } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ContactTimeline } from "@/components/contacts/contact-timeline";

export function ContactQuickView({
  contact,
  open,
  onClose,
}: {
  contact: Contact | null;
  open: boolean;
  onClose: () => void;
}) {
  const detailQuery = useQuery({
    queryKey: ["contact", contact?.id],
    queryFn: () => api.contacts.get(contact!.id),
    enabled: open && Boolean(contact?.id),
  });

  return (
    <AnimatePresence>
      {open && contact && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-zinc-950/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-border bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Detail kontak</p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="border-b border-border p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                    {initials(contact.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold">
                      {contact.name}
                    </h3>
                    {contact.company && (
                      <p className="truncate text-sm text-muted-foreground">
                        {contact.company}
                      </p>
                    )}
                  </div>
                </div>

                <dl className="mt-4 grid gap-2 text-sm">
                  {contact.phone && (
                    <InfoRow icon={Phone} value={contact.phone} />
                  )}
                  {contact.email && (
                    <InfoRow icon={Mail} value={contact.email} />
                  )}
                  {contact.location && (
                    <InfoRow icon={MapPin} value={contact.location} />
                  )}
                  {contact.company && (
                    <InfoRow icon={Building2} value={contact.company} />
                  )}
                  {contact.birthday && (
                    <InfoRow icon={Cake} value={contact.birthday} />
                  )}
                  {contact.notes && (
                    <InfoRow icon={StickyNote} value={contact.notes} multiline />
                  )}
                </dl>

                {detailQuery.data?.tags && detailQuery.data.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1">
                    {detailQuery.data.tags.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px]"
                        style={{
                          background: `${t.color}1a`,
                          color: t.color,
                        }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Aktivitas terbaru
                </p>
                {detailQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 rounded-lg" />
                    ))}
                  </div>
                ) : detailQuery.data ? (
                  <ContactTimeline
                    activities={detailQuery.data.activities.slice(0, 8)}
                    messages={detailQuery.data.messages.slice(0, 8)}
                  />
                ) : null}
              </div>
            </div>

            <div className="border-t border-border bg-zinc-50/60 p-3">
              <Button asChild className="w-full">
                <Link href={`/dashboard/contacts/${contact.id}`}>
                  Buka halaman penuh <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function InfoRow({
  icon: Icon,
  value,
  multiline,
}: {
  icon: typeof Mail;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <span
        className={
          multiline
            ? "whitespace-pre-wrap text-zinc-700"
            : "truncate text-zinc-700"
        }
      >
        {value}
      </span>
    </div>
  );
}
