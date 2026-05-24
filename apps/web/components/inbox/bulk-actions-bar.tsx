"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  CheckCircle2,
  Loader2,
  ShieldAlert,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import type { ConversationStatus } from "@aichat/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BulkAgent {
  id: string;
  name: string;
}

export function BulkActionsBar({
  selectedCount,
  agents,
  currentUserId,
  onAssign,
  onUpdateStatus,
  onClear,
  pending,
}: {
  selectedCount: number;
  agents: BulkAgent[];
  currentUserId: string | null;
  onAssign: (agentId: string | null) => Promise<void> | void;
  onUpdateStatus: (status: ConversationStatus) => Promise<void> | void;
  onClear: () => void;
  pending?: boolean;
}) {
  const [assignOpen, setAssignOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-1.5 border-b border-border bg-zinc-900 px-3 py-2 text-white"
    >
      <span className="mr-1 text-xs font-medium">
        {selectedCount} dipilih
      </span>

      <div className="relative">
        <BulkBtn
          icon={UserPlus}
          label="Assign"
          onClick={() => setAssignOpen((s) => !s)}
          disabled={pending || selectedCount === 0}
        />
        {assignOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-border bg-white p-1 text-zinc-900 shadow-lg">
            {currentUserId && (
              <button
                type="button"
                onClick={async () => {
                  setAssignOpen(false);
                  await onAssign(currentUserId);
                }}
                className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-zinc-100"
              >
                Assign ke saya
              </button>
            )}
            {agents.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={async () => {
                  setAssignOpen(false);
                  await onAssign(a.id);
                }}
                className="block w-full truncate rounded-md px-2 py-1.5 text-left text-xs hover:bg-zinc-100"
              >
                {a.name}
              </button>
            ))}
            <div className="my-1 h-px bg-zinc-100" />
            <button
              type="button"
              onClick={async () => {
                setAssignOpen(false);
                await onAssign(null);
              }}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
            >
              <UserMinus className="h-3 w-3" /> Unassign
            </button>
          </div>
        )}
      </div>

      <BulkBtn
        icon={CheckCircle2}
        label="Resolve"
        onClick={() => onUpdateStatus("resolved")}
        disabled={pending || selectedCount === 0}
      />
      <BulkBtn
        icon={ShieldAlert}
        label="Spam"
        onClick={() => onUpdateStatus("spam")}
        disabled={pending || selectedCount === 0}
        danger
      />

      <div className="ml-auto flex items-center gap-1">
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-white/80 hover:bg-white/10 hover:text-white"
          onClick={onClear}
          aria-label="Tutup bulk mode"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function BulkBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: typeof X;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50",
        danger
          ? "text-red-200 hover:bg-red-500/20 hover:text-red-100"
          : "text-white/90 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
