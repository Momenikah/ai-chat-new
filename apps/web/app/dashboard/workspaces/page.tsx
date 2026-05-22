"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Building2,
  Check,
  CreditCard,
  Loader2,
  Plus,
  Search,
  Settings,
  Trash2,
  UsersRound,
} from "lucide-react";
import type { WorkspaceWithRole } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WorkspacesStats } from "@/components/workspaces/workspaces-stats";
import {
  BrandingPreview,
  ColorPresets,
} from "@/components/settings/branding-preview";

const TIMEZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Pontianak",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Bangkok",
  "Asia/Manila",
  "Asia/Tokyo",
  "UTC",
];

type SortKey = "newest" | "name" | "role";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Terbaru" },
  { key: "name", label: "Nama A–Z" },
  { key: "role", label: "Role tertinggi" },
];

const ROLE_RANK: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  AGENT: 2,
  VIEWER: 1,
};

export default function WorkspacesPage() {
  const queryClient = useQueryClient();
  const currentId = useWorkspaceStore((s) => s.currentId);
  const setCurrentId = useWorkspaceStore((s) => s.setCurrentId);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: api.workspaces.list,
  });

  const workspaces = useMemo(() => data?.workspaces ?? [], [data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? workspaces.filter(
          (w) =>
            w.name.toLowerCase().includes(q) ||
            w.slug.toLowerCase().includes(q),
        )
      : workspaces.slice();
    filtered.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name, "id");
        case "role":
          return (
            (ROLE_RANK[b.member_role] ?? 0) - (ROLE_RANK[a.member_role] ?? 0)
          );
        case "newest":
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });
    return filtered;
  }, [workspaces, search, sort]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["workspaces"] });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-5xl space-y-5"
    >
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Setiap bisnis memiliki workspace sendiri dengan tim, channel, dan
            data yang terpisah.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Workspace baru
        </Button>
      </div>

      {!isLoading && <WorkspacesStats workspaces={workspaces} />}

      {workspaces.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau slug…"
              className="h-9 w-full rounded-lg border border-input bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:bg-white"
            />
          </div>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-9 w-44 text-sm"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                Urutkan: {s.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : visible.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          Tidak ada workspace yang cocok dengan pencarian.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((ws, i) => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              index={i}
              active={ws.id === currentId}
              onActivate={() => setCurrentId(ws.id)}
              onDeleted={invalidate}
            />
          ))}
          <NewWorkspaceCard onClick={() => setCreateOpen(true)} />
        </div>
      )}

      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidate}
      />
    </motion.div>
  );
}

/* ------------------------------ Card ----------------------------------- */

function WorkspaceCard({
  workspace,
  index,
  active,
  onActivate,
  onDeleted,
}: {
  workspace: WorkspaceWithRole;
  index: number;
  active: boolean;
  onActivate: () => void;
  onDeleted: () => void;
}) {
  const setCurrentId = useWorkspaceStore((s) => s.setCurrentId);
  const deleteMutation = useMutation({
    mutationFn: () => api.workspaces.remove(workspace.id),
    onSuccess: onDeleted,
  });
  const [imgOk, setImgOk] = useState(true);
  const showLogo = Boolean(workspace.logo_url) && imgOk;

  // Open a workspace-scoped page after switching the active workspace, so
  // the quick action navigates to the right tenant context.
  const goTo = (href: string) => {
    if (!active) setCurrentId(workspace.id);
    return href;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2), duration: 0.25 }}
      whileHover={{ y: -2 }}
    >
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        {/* Brand accent band */}
        <div
          className="h-2 w-full"
          style={{ background: workspace.brand_color }}
        />
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-semibold text-white"
              style={{ background: workspace.brand_color }}
            >
              {showLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={workspace.logo_url as string}
                  alt={workspace.name}
                  className="h-full w-full object-cover"
                  onError={() => setImgOk(false)}
                  onLoad={() => setImgOk(true)}
                />
              ) : (
                workspace.name.charAt(0).toUpperCase()
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{workspace.name}</p>
                {active && <Badge variant="success">Aktif</Badge>}
              </div>
              <p className="truncate font-mono text-xs text-muted-foreground">
                /{workspace.slug}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Timezone: {workspace.timezone}
              </p>
            </div>
            <Badge variant="secondary">{workspace.member_role}</Badge>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button
              size="sm"
              variant={active ? "secondary" : "outline"}
              onClick={onActivate}
              disabled={active}
              className="flex-1"
            >
              {active ? (
                <>
                  <Check className="h-4 w-4" /> Sedang dipakai
                </>
              ) : (
                "Jadikan aktif"
              )}
            </Button>
            {workspace.member_role === "OWNER" && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Hapus workspace "${workspace.name}"?`)) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
                className="text-red-600 hover:bg-red-50 hover:text-red-600"
                aria-label="Hapus workspace"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          {/* Quick actions */}
          <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-border pt-3">
            <QuickAction
              href={goTo("/dashboard/settings")}
              icon={Settings}
              label="Pengaturan"
            />
            <QuickAction
              href={goTo("/dashboard/settings/team")}
              icon={UsersRound}
              label="Tim"
            />
            <QuickAction
              href={goTo("/dashboard/billing")}
              icon={CreditCard}
              label="Billing"
            />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Settings;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex flex-col items-center gap-1 rounded-md py-1.5 text-[10px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

function NewWorkspaceCard({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 bg-white p-5 text-center text-muted-foreground transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
        <Plus className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium">Buat workspace baru</p>
      <p className="text-xs">Pisahkan tim, channel, dan data per bisnis.</p>
    </motion.button>
  );
}

/* --------------------------- Empty state ------------------------------- */

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-white">
        <Building2 className="h-6 w-6" />
      </span>
      <div>
        <p className="font-semibold">Belum punya workspace</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Workspace memisahkan tim, channel, dan data per bisnis Anda. Mulai
          dengan satu workspace untuk satu brand.
        </p>
      </div>
      <Button onClick={onCreate} className="mt-2">
        <Plus className="h-4 w-4" /> Buat workspace pertama
      </Button>
    </Card>
  );
}

/* --------------------------- Create dialog ----------------------------- */

function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const setCurrentId = useWorkspaceStore((s) => s.setCurrentId);
  const [name, setName] = useState("");
  const [brandColor, setBrandColor] = useState("#4f46e5");
  const [timezone, setTimezone] = useState("Asia/Jakarta");

  const mutation = useMutation({
    mutationFn: () =>
      api.workspaces.create({
        name,
        brand_color: brandColor,
        timezone,
      }),
    onSuccess: (ws) => {
      onCreated();
      // Make the freshly created workspace active so the user lands in it.
      setCurrentId(ws.id);
      onOpenChange(false);
      setName("");
      setBrandColor("#4f46e5");
      setTimezone("Asia/Jakarta");
    },
  });

  const error =
    mutation.error instanceof ApiException ? mutation.error.message : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <span className="hidden" />
      </DialogTrigger>
      <DialogContent className={cn("max-w-2xl")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Buat workspace baru
          </DialogTitle>
          <DialogDescription>
            Workspace baru dimulai dengan Anda sebagai OWNER.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
          <form
            id="create-workspace"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="ws-name">Nama bisnis</Label>
              <Input
                id="ws-name"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="PT Maju Jaya"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-color">Warna brand</Label>
              <div className="flex items-center gap-3">
                <input
                  id="ws-color"
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded-lg border border-input"
                />
                <span className="text-sm text-muted-foreground">
                  {brandColor}
                </span>
              </div>
              <ColorPresets
                value={brandColor}
                onPick={(hex) => setBrandColor(hex)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-tz">Timezone</Label>
              <Select
                id="ws-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
          </form>

          <BrandingPreview
            name={name}
            logoUrl=""
            brandColor={brandColor}
          />
        </div>

        <DialogFooter>
          <Button
            type="submit"
            form="create-workspace"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Buat workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
