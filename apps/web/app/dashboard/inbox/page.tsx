"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  CheckSquare,
  Circle,
  Inbox as InboxIcon,
  Keyboard,
  MessagesSquare,
} from "lucide-react";
import type {
  ChannelType,
  Conversation,
  ConversationListItem,
  ConversationStatus,
  InboxEvent,
  InternalNote,
  Message,
  PresencePayload,
  TypingPayload,
} from "@aichat/shared";
import { api } from "@/lib/api";
import { cn, initials } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useInboxSocket } from "@/hooks/use-inbox-socket";
import { useInboxShortcuts } from "@/hooks/use-inbox-shortcuts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ConversationList,
} from "@/components/inbox/conversation-list";
import {
  InboxFilters,
  type InboxFilter,
} from "@/components/inbox/inbox-filters";
import { ChatThread } from "@/components/inbox/chat-thread";
import {
  MessageComposer,
  type MessageComposerHandle,
} from "@/components/inbox/message-composer";
import { CustomerProfile } from "@/components/inbox/customer-profile";
import { BulkActionsBar } from "@/components/inbox/bulk-actions-bar";
import { ShortcutHelp } from "@/components/inbox/shortcut-help";
import { CHANNEL_META } from "@/components/channels/channel-meta";

export default function InboxPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const user = useAuthStore((s) => s.user);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelType | null>(null);
  const [search, setSearch] = useState("");
  const [typing, setTyping] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;

  const composerRef = useRef<MessageComposerHandle>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ------------------------------ Queries ------------------------------ */

  const conversationsQuery = useQuery({
    queryKey: ["conversations", workspaceId],
    queryFn: () => api.conversations.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const detailQuery = useQuery({
    queryKey: ["conversation", selectedId],
    queryFn: () => api.conversations.get(selectedId as string),
    enabled: Boolean(selectedId),
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", selectedId],
    queryFn: () => api.messages.list(selectedId as string),
    enabled: Boolean(selectedId),
  });

  const notesQuery = useQuery({
    queryKey: ["notes", selectedId],
    queryFn: () => api.notes.list(selectedId as string),
    enabled: Boolean(selectedId),
  });

  const membersQuery = useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => api.members.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const quickRepliesQuery = useQuery({
    queryKey: ["quick-replies", workspaceId],
    queryFn: () => api.quickReplies.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  /* ------------------------------ Mutations ---------------------------- */

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      api.messages.send(selectedId as string, { body }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: ConversationStatus) =>
      api.conversations.updateStatus(selectedId as string, status),
  });

  const assignMutation = useMutation({
    mutationFn: (agentId: string | null) =>
      api.conversations.assign(selectedId as string, agentId),
  });

  const noteMutation = useMutation({
    mutationFn: (body: string) =>
      api.notes.create(selectedId as string, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notes", selectedId] }),
  });

  /* --------------------------- Realtime / WS --------------------------- */

  const handleEvent = useCallback(
    (event: InboxEvent) => {
      switch (event.type) {
        case "message.new": {
          const msg = event.payload as Message;
          const isCurrent = selectedRef.current === msg.conversation_id;
          if (isCurrent) {
            queryClient.setQueryData<{ messages: Message[] }>(
              ["messages", msg.conversation_id],
              (old) =>
                old && old.messages.some((m) => m.id === msg.id)
                  ? old
                  : old
                    ? { messages: [...old.messages, msg] }
                    : { messages: [msg] },
            );
          }
          // Bump last_message_at + unread (or zero unread when current).
          queryClient.setQueryData<{
            conversations: ConversationListItem[];
          }>(["conversations", workspaceId], (old) =>
            old
              ? {
                  conversations: old.conversations.map((c) =>
                    c.id === msg.conversation_id
                      ? {
                          ...c,
                          last_message_at: msg.created_at,
                          last_message_preview: msg.body ?? c.last_message_preview,
                          unread_count: isCurrent
                            ? 0
                            : msg.direction === "inbound"
                              ? c.unread_count + 1
                              : c.unread_count,
                        }
                      : c,
                  ),
                }
              : old,
          );
          break;
        }
        case "message.updated": {
          const msg = event.payload as Message;
          if (selectedRef.current === msg.conversation_id) {
            queryClient.setQueryData<{ messages: Message[] }>(
              ["messages", msg.conversation_id],
              (old) =>
                old
                  ? {
                      messages: old.messages.map((m) =>
                        m.id === msg.id ? { ...m, ...msg } : m,
                      ),
                    }
                  : old,
            );
          }
          break;
        }
        case "conversation.updated":
        case "conversation.assigned": {
          const conv = event.payload as Conversation;
          queryClient.invalidateQueries({
            queryKey: ["conversations", workspaceId],
          });
          if (selectedRef.current === conv.id) {
            queryClient.invalidateQueries({
              queryKey: ["conversation", conv.id],
            });
          }
          break;
        }
        case "note.new": {
          const note = event.payload as InternalNote;
          if (selectedRef.current === note.conversation_id) {
            queryClient.setQueryData<{ notes: InternalNote[] }>(
              ["notes", note.conversation_id],
              (old) =>
                old
                  ? { notes: [note, ...old.notes] }
                  : { notes: [note] },
            );
          }
          break;
        }
        case "typing": {
          const p = event.payload as TypingPayload;
          if (
            selectedRef.current === p.conversation_id &&
            p.user_id !== user?.id
          ) {
            setTyping(true);
            setTimeout(() => setTyping(false), 2000);
          }
          break;
        }
        case "presence.update": {
          void (event.payload as PresencePayload);
          break;
        }
      }
    },
    [queryClient, workspaceId, user?.id],
  );

  const { status: socketStatus, sendTyping } = useInboxSocket(
    workspaceId,
    handleEvent,
  );

  /* ------------------------------ Derived ------------------------------ */

  const allConversations = conversationsQuery.data?.conversations ?? [];

  const counts = useMemo(() => {
    const c = { all: 0, mine: 0, unassigned: 0, unread: 0, resolved: 0 };
    for (const conv of allConversations) {
      c.all++;
      if (conv.assigned_agent_id === user?.id) c.mine++;
      if (!conv.assigned_agent_id) c.unassigned++;
      if (conv.unread_count > 0) c.unread++;
      if (conv.status === "resolved") c.resolved++;
    }
    return c;
  }, [allConversations, user?.id]);

  const channelCounts = useMemo(() => {
    const c: Record<ChannelType, number> = {
      whatsapp: 0,
      instagram: 0,
      messenger: 0,
    };
    for (const conv of allConversations) c[conv.channel_type]++;
    return c;
  }, [allConversations]);

  const visibleConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allConversations.filter((c) => {
      if (channelFilter && c.channel_type !== channelFilter) return false;
      if (q) {
        const haystack = `${c.contact_name} ${c.last_message_preview ?? ""}`
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      switch (filter) {
        case "mine":
          return c.assigned_agent_id === user?.id;
        case "unassigned":
          return !c.assigned_agent_id;
        case "unread":
          return c.unread_count > 0;
        case "resolved":
          return c.status === "resolved";
        case "all":
        default:
          return true;
      }
    });
  }, [allConversations, channelFilter, filter, search, user?.id]);

  const selectedListItem = useMemo(
    () => allConversations.find((c) => c.id === selectedId) ?? null,
    [allConversations, selectedId],
  );

  // Auto-select the first conversation when the list loads.
  useEffect(() => {
    if (!selectedId && visibleConversations.length > 0) {
      setSelectedId(visibleConversations[0].id);
    }
  }, [selectedId, visibleConversations]);

  // When the agent opens a conversation, optimistically zero its unread
  // count in the list (the backend mirrors this on `GET /messages`).
  useEffect(() => {
    if (!selectedId || !workspaceId) return;
    queryClient.setQueryData<{ conversations: ConversationListItem[] }>(
      ["conversations", workspaceId],
      (old) =>
        old
          ? {
              conversations: old.conversations.map((c) =>
                c.id === selectedId ? { ...c, unread_count: 0 } : c,
              ),
            }
          : old,
    );
  }, [selectedId, workspaceId, queryClient]);

  const agents = useMemo(
    () =>
      (membersQuery.data?.members ?? [])
        .filter((m) => m.status === "active")
        .map((m) => ({ id: m.user_id, name: m.user_name })),
    [membersQuery.data],
  );

  /* -------------------------- Bulk actions ---------------------------- */

  const toggleBulkSelect = useCallback((id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitBulkMode = useCallback(() => {
    setBulkMode(false);
    setBulkSelected(new Set());
  }, []);

  const runBulk = useCallback(
    async (action: (id: string) => Promise<unknown>) => {
      if (!workspaceId || bulkSelected.size === 0) return;
      setBulkPending(true);
      try {
        const ids = Array.from(bulkSelected);
        await Promise.all(ids.map((id) => action(id)));
        queryClient.invalidateQueries({
          queryKey: ["conversations", workspaceId],
        });
      } finally {
        setBulkPending(false);
        exitBulkMode();
      }
    },
    [bulkSelected, exitBulkMode, queryClient, workspaceId],
  );

  /* -------------------------- AI suggest ------------------------------ */

  const suggestReply = useCallback(async (): Promise<string> => {
    if (!workspaceId) throw new Error("Workspace tidak aktif");
    const msgs = messagesQuery.data?.messages ?? [];
    const lastInbound = [...msgs]
      .reverse()
      .find((m) => m.direction === "inbound" && m.body?.trim());
    if (!lastInbound?.body) {
      throw new Error("Belum ada pesan masuk untuk disarankan balasannya.");
    }
    const result = await api.ai.playground(workspaceId, {
      message: lastInbound.body,
    });
    return result.response;
  }, [messagesQuery.data, workspaceId]);

  /* -------------------------- Shortcuts ------------------------------- */

  useInboxShortcuts({
    onNext: () => {
      const idx = visibleConversations.findIndex((c) => c.id === selectedId);
      const nextIdx = Math.min(idx + 1, visibleConversations.length - 1);
      if (nextIdx >= 0 && visibleConversations[nextIdx]) {
        setSelectedId(visibleConversations[nextIdx].id);
      }
    },
    onPrev: () => {
      const idx = visibleConversations.findIndex((c) => c.id === selectedId);
      const prevIdx = Math.max(idx - 1, 0);
      if (visibleConversations[prevIdx]) {
        setSelectedId(visibleConversations[prevIdx].id);
      }
    },
    onFocusComposer: () => composerRef.current?.focus(),
    onFocusSearch: () => searchInputRef.current?.focus(),
    onResolve: () => {
      if (selectedId) statusMutation.mutate("resolved");
    },
    onAssignSelf: () => {
      if (selectedId && user?.id) assignMutation.mutate(user.id);
    },
    onToggleBulk: () => {
      if (bulkMode) exitBulkMode();
      else setBulkMode(true);
    },
    onShowHelp: () => setHelpOpen(true),
    onEscape: () => {
      if (helpOpen) setHelpOpen(false);
      else if (bulkMode) exitBulkMode();
    },
  });

  /* ------------------------------ Render ------------------------------- */

  if (!workspaceId) {
    return (
      <EmptyShell message="Pilih workspace untuk melihat inbox." />
    );
  }

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100vh-3.5rem)] bg-white">
      {/* Left: conversation list */}
      <div className="flex w-80 shrink-0 flex-col border-r border-border bg-white">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <InboxIcon className="h-4 w-4 text-zinc-700" />
            <h1 className="text-sm font-semibold tracking-tight">Inbox</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (bulkMode) exitBulkMode();
                else setBulkMode(true);
              }}
              aria-label="Mode pilih banyak"
              title="Bulk select (b)"
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                bulkMode
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              <CheckSquare className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="Keyboard shortcuts"
              title="Shortcuts (?)"
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            >
              <Keyboard className="h-3.5 w-3.5" />
            </button>
            <SocketDot status={socketStatus} />
          </div>
        </div>

        {bulkMode && (
          <BulkActionsBar
            selectedCount={bulkSelected.size}
            agents={agents}
            currentUserId={user?.id ?? null}
            onAssign={(agentId) =>
              runBulk((id) => api.conversations.assign(id, agentId))
            }
            onUpdateStatus={(status) =>
              runBulk((id) => api.conversations.updateStatus(id, status))
            }
            onClear={exitBulkMode}
            pending={bulkPending}
          />
        )}

        <InboxFilters
          filter={filter}
          onFilterChange={setFilter}
          channelFilter={channelFilter}
          onChannelFilterChange={setChannelFilter}
          channelCounts={channelCounts}
          searchRef={searchInputRef}
          search={search}
          onSearchChange={setSearch}
          counts={counts}
        />

        {conversationsQuery.isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : (
          <ConversationList
            items={visibleConversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            bulkMode={bulkMode}
            selectedIds={bulkSelected}
            onToggleSelect={toggleBulkSelect}
          />
        )}
      </div>

      {/* Center: chat thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!selectedId ? (
          <EmptyState />
        ) : (
          <>
            <ConversationHeader item={selectedListItem} />
            {messagesQuery.isLoading ? (
              <div className="flex-1 space-y-2 bg-zinc-50/40 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-2xl" />
                ))}
              </div>
            ) : (
              <ChatThread
                messages={messagesQuery.data?.messages ?? []}
                typing={typing}
              />
            )}
            <MessageComposer
              ref={composerRef}
              disabled={sendMutation.isPending}
              onSend={(body) => sendMutation.mutate(body)}
              onTyping={() => selectedId && sendTyping(selectedId)}
              quickReplies={quickRepliesQuery.data?.quick_replies}
              onSuggestReply={suggestReply}
            />
          </>
        )}
      </div>

      {/* Right: customer profile */}
      {selectedId && detailQuery.data && (
        <CustomerProfile
          detail={detailQuery.data}
          notes={notesQuery.data?.notes ?? []}
          agents={agents}
          onChangeStatus={(s) => statusMutation.mutate(s)}
          onAssign={(id) => assignMutation.mutate(id)}
          onAddNote={(body) => noteMutation.mutate(body)}
          isAddingNote={noteMutation.isPending}
        />
      )}

      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function ConversationHeader({
  item,
}: {
  item: ConversationListItem | null;
}) {
  if (!item) return null;
  const meta = CHANNEL_META[item.channel_type];
  const ChannelIcon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-14 items-center gap-3 border-b border-border bg-white px-4"
    >
      <div className="relative">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
          {initials(item.contact_name)}
        </div>
        <span
          className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-1 ring-zinc-200"
          style={{ color: meta.color }}
        >
          <ChannelIcon className="h-2.5 w-2.5" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.contact_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.channel_name} • {meta.label}
        </p>
      </div>
      <Badge variant="secondary" className="capitalize">
        {item.status}
      </Badge>
    </motion.div>
  );
}

function SocketDot({
  status,
}: {
  status: "connecting" | "open" | "closed";
}) {
  const color =
    status === "open"
      ? "text-emerald-500"
      : status === "connecting"
        ? "text-amber-500"
        : "text-zinc-400";
  const label =
    status === "open"
      ? "realtime aktif"
      : status === "connecting"
        ? "menghubungkan…"
        : "offline";
  return (
    <span
      title={label}
      className={cn("flex items-center gap-1 text-[10px]", color)}
    >
      <Circle className="h-2 w-2 fill-current" />
      <span className="uppercase tracking-wider">{status}</span>
    </span>
  );
}

function EmptyShell({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-zinc-50/40 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
        <MessagesSquare className="h-6 w-6 text-zinc-500" />
      </div>
      <div>
        <p className="font-medium">Pilih percakapan</p>
        <p className="text-sm text-muted-foreground">
          Klik salah satu chat di kiri untuk mulai membalas.
        </p>
      </div>
    </div>
  );
}
