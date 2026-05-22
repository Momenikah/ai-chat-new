"use client";

import { motion } from "motion/react";
import {
  CheckCircle2,
  Mail,
  Phone,
  Tag as TagIcon,
  UserCog,
} from "lucide-react";
import type {
  ConversationDetail,
  ConversationStatus,
  InternalNote as Note,
} from "@aichat/shared";
import { CONVERSATION_STATUSES } from "@aichat/shared";
import { cn, initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { CHANNEL_META } from "@/components/channels/channel-meta";
import { InternalNote, InternalNoteComposer } from "./internal-note";

interface AgentOption {
  id: string;
  name: string;
}

export function CustomerProfile({
  detail,
  notes,
  agents,
  onChangeStatus,
  onAssign,
  onAddNote,
  isAddingNote,
}: {
  detail: ConversationDetail;
  notes: Note[];
  agents: AgentOption[];
  onChangeStatus: (status: ConversationStatus) => void;
  onAssign: (agentId: string | null) => void;
  onAddNote: (body: string) => void;
  isAddingNote: boolean;
}) {
  const { contact, conversation, tags } = detail;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-white"
    >
      {/* Identity */}
      <div className="flex flex-col items-center gap-3 px-5 py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-base font-semibold text-white">
          {initials(contact?.name ?? "?")}
        </div>
        <div>
          <p className="text-base font-semibold tracking-tight">
            {contact?.name ?? "Customer"}
          </p>
          {contact?.external_source && (
            <p className="text-xs text-muted-foreground">
              via {CHANNEL_META[contact.external_source].label}
            </p>
          )}
        </div>
        <Badge
          variant={statusVariant(conversation.status)}
          className={cn("capitalize")}
        >
          {conversation.status}
        </Badge>
      </div>

      {/* Contact fields */}
      <Section title="Kontak">
        <Field icon={Phone} value={contact?.phone ?? "—"} />
        <Field icon={Mail} value={contact?.email ?? "—"} />
      </Section>

      {/* Tags */}
      <Section title="Tags">
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada tag.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                style={{
                  background: `${t.color}1a`,
                  color: t.color,
                }}
              >
                <TagIcon className="h-2.5 w-2.5" />
                {t.name}
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* Conversation controls */}
      <Section title="Tindakan">
        <div className="space-y-2">
          <label className="block text-[11px] font-medium text-muted-foreground">
            Status
          </label>
          <Select
            value={conversation.status}
            onChange={(e) =>
              onChangeStatus(e.target.value as ConversationStatus)
            }
            className="h-8 text-xs"
          >
            {CONVERSATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>

          <label className="mt-2 block text-[11px] font-medium text-muted-foreground">
            Ditugaskan ke
          </label>
          <Select
            value={conversation.assigned_agent_id ?? ""}
            onChange={(e) => onAssign(e.target.value || null)}
            className="h-8 text-xs"
          >
            <option value="">Belum di-assign</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>

          {conversation.status !== "resolved" && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              onClick={() => onChangeStatus("resolved")}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tandai selesai
            </Button>
          )}
        </div>
      </Section>

      {/* Notes */}
      <Section title="Catatan Internal" icon={UserCog}>
        <InternalNoteComposer
          onSubmit={onAddNote}
          pending={isAddingNote}
        />
        <div className="mt-3 space-y-2">
          {notes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Belum ada catatan.
            </p>
          ) : (
            notes.map((n) => <InternalNote key={n.id} note={n} />)
          )}
        </div>
      </Section>
    </motion.div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-border px-5 py-4">
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
        {Icon && <Icon className="h-3 w-3" />}
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}) {
  return (
    <p className="flex items-center gap-2 text-sm">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="truncate">{value}</span>
    </p>
  );
}

function statusVariant(s: ConversationStatus) {
  switch (s) {
    case "open":
      return "success" as const;
    case "pending":
      return "warning" as const;
    case "resolved":
      return "secondary" as const;
    case "spam":
      return "destructive" as const;
  }
}
