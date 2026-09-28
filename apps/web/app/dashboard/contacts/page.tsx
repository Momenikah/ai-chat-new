"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { CheckSquare, Download, Loader2, Plus, Upload } from "lucide-react";
import type { ChannelType, Contact } from "@aichat/shared";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ContactFilters,
  type ContactFilterState,
} from "@/components/contacts/contact-filters";
import {
  ContactTable,
  type ContactSortKey,
  type SortDir,
} from "@/components/contacts/contact-table";
import { ContactsStats } from "@/components/contacts/contacts-stats";
import { DuplicateAlert } from "@/components/contacts/duplicate-alert";
import { ContactsBulkBar } from "@/components/contacts/contacts-bulk-bar";
import { ContactQuickView } from "@/components/contacts/contact-quick-view";
import { ContactsPagination } from "@/components/contacts/contacts-pagination";

const PAGE_SIZE = 25;

export default function ContactsPage() {
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<ContactFilterState>({
    search: "",
    channel: "",
    tagId: "",
    quick: null,
  });
  const [sortKey, setSortKey] = useState<ContactSortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const [quickView, setQuickView] = useState<Contact | null>(null);

  /* ----------------------------- Queries ------------------------------ */

  const tagsQuery = useQuery({
    queryKey: ["tags", workspaceId],
    queryFn: () => api.tags.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const contactsQuery = useQuery({
    queryKey: [
      "contacts",
      workspaceId,
      filters.search,
      filters.channel,
      filters.tagId,
    ],
    queryFn: () =>
      api.contacts.list(workspaceId as string, {
        search: filters.search || undefined,
        channel: (filters.channel || undefined) as ChannelType | undefined,
        tag: filters.tagId || undefined,
      }),
    enabled: Boolean(workspaceId),
  });

  const duplicatesQuery = useQuery({
    queryKey: ["contacts", "duplicates", workspaceId],
    queryFn: () => api.contacts.duplicates(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const tags = tagsQuery.data?.tags ?? [];
  const allContacts = useMemo(
    () => contactsQuery.data?.contacts ?? [],
    [contactsQuery.data],
  );
  const duplicates = duplicatesQuery.data?.contacts ?? [];

  /* --------------------- Quick filter + sort --------------------------- */

  const filteredContacts = useMemo(() => {
    if (!filters.quick) return allContacts;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    return allContacts.filter((c) => {
      switch (filters.quick) {
        case "new_today":
          return new Date(c.created_at).getTime() >= dayStart.getTime();
        case "with_company":
          return Boolean(c.company && c.company.trim());
        case "no_email":
          return !c.email;
        case "no_phone":
          return !c.phone;
        default:
          return true;
      }
    });
  }, [allContacts, filters.quick]);

  const sortedContacts = useMemo(() => {
    const arr = [...filteredContacts];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name, "id");
          break;
        case "created_at":
          cmp =
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime();
          break;
        case "last_seen_at": {
          const av = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
          const bv = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
          cmp = av - bv;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredContacts, sortKey, sortDir]);

  // Reset to first page whenever the result set changes meaningfully.
  useEffect(() => {
    setPage(1);
  }, [filters, sortKey, sortDir]);

  const pagedContacts = useMemo(
    () => sortedContacts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sortedContacts, page],
  );

  /* ------------------------- Bulk handlers ----------------------------- */

  function toggleSelect(id: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      for (const c of pagedContacts) {
        if (checked) next.add(c.id);
        else next.delete(c.id);
      }
      return next;
    });
  }

  function exitBulk() {
    setBulkMode(false);
    setBulkSelected(new Set());
  }

  async function runBulk<T>(
    action: (id: string) => Promise<T>,
    invalidate = true,
  ) {
    if (bulkSelected.size === 0) return;
    setBulkPending(true);
    try {
      const ids = Array.from(bulkSelected);
      await Promise.all(ids.map((id) => action(id)));
      if (invalidate && workspaceId) {
        queryClient.invalidateQueries({
          queryKey: ["contacts", workspaceId],
        });
        queryClient.invalidateQueries({
          queryKey: ["contacts", "duplicates", workspaceId],
        });
      }
    } finally {
      setBulkPending(false);
      exitBulk();
    }
  }

  function handleSort(key: ContactSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  /* ------------------------------ Render ------------------------------- */

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-6xl space-y-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Kontak CRM</h1>
          <p className="text-sm text-muted-foreground">
            {allContacts.length} kontak dalam workspace ini.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (bulkMode) exitBulk();
              else setBulkMode(true);
            }}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors",
              bulkMode
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-border bg-white text-zinc-700 hover:bg-zinc-50",
            )}
          >
            <CheckSquare className="h-4 w-4" />
            {bulkMode ? "Batal" : "Pilih banyak"}
          </button>
          <ExportButton workspaceId={workspaceId} />
          <Button variant="outline" asChild>
            <Link href="/dashboard/contacts/import">
              <Upload className="h-4 w-4" /> Import CSV
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/contacts/new">
              <Plus className="h-4 w-4" /> Kontak baru
            </Link>
          </Button>
        </div>
      </div>

      <ContactsStats
        contacts={allContacts}
        duplicatesCount={duplicates.length}
      />

      <DuplicateAlert duplicates={duplicates} />

      <ContactFilters state={filters} onChange={setFilters} tags={tags} />

      {bulkMode && bulkSelected.size > 0 && (
        <ContactsBulkBar
          selectedCount={bulkSelected.size}
          tags={tags}
          pending={bulkPending}
          onAttachTag={(tagId) =>
            runBulk((id) => api.contacts.attachTag(id, tagId))
          }
          onDetachTag={(tagId) =>
            runBulk((id) => api.contacts.detachTag(id, tagId))
          }
          onDelete={() => {
            if (!confirm(`Hapus ${bulkSelected.size} kontak terpilih?`)) {
              return;
            }
            return runBulk((id) => api.contacts.remove(id));
          }}
          onClear={exitBulk}
        />
      )}

      {contactsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <ContactTable
            contacts={pagedContacts}
            bulkMode={bulkMode}
            selectedIds={bulkSelected}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            onQuickView={(c) => setQuickView(c)}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortChange={handleSort}
          />
          <ContactsPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={sortedContacts.length}
            onPageChange={setPage}
          />
        </>
      )}

      <ContactQuickView
        contact={quickView}
        open={quickView !== null}
        onClose={() => setQuickView(null)}
      />
    </motion.div>
  );
}

function ExportButton({ workspaceId }: { workspaceId: string | null }) {
  const [downloading, setDownloading] = useState(false);

  async function download() {
    if (!workspaceId) return;
    setDownloading(true);
    try {
      const res = await fetch(api.contacts.exportCSVUrl(workspaceId), {
        headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
      });
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button variant="outline" onClick={download} disabled={downloading}>
      {downloading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Export CSV
    </Button>
  );
}
