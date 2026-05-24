"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";
import { api, ApiException } from "@/lib/api";
import { clearTokens } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);

  // The API verifies the JWT on /auth/me.
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: api.auth.me,
    retry: false,
  });

  // Workspaces the user belongs to (drives the switcher + tenant context).
  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: api.workspaces.list,
    enabled: meQuery.isSuccess,
    retry: false,
  });

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data);
      setHydrated(true);
    }
  }, [meQuery.data, setUser, setHydrated]);

  useEffect(() => {
    if (workspacesQuery.data) {
      setWorkspaces(workspacesQuery.data.workspaces);
    }
  }, [workspacesQuery.data, setWorkspaces]);

  useEffect(() => {
    const err = meQuery.error;
    if (err instanceof ApiException && err.status === 401) {
      clearTokens();
      router.replace("/login");
    }
  }, [meQuery.error, router]);

  // Block ONLY on auth — render the shell immediately once the user is
  // known so the user sees the chrome while workspaces/data continue to
  // stream in. The sidebar + workspace switcher handle their own loading.
  if (meQuery.isLoading || !meQuery.data) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-xl bg-zinc-950">
            <MessagesSquare className="h-5 w-5 text-white" />
          </div>
          <p className="text-sm text-muted-foreground">Memuat workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50/60">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={meQuery.data} />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
