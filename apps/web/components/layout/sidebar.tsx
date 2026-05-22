"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ChevronsLeft, Lock, MessagesSquare } from "lucide-react";
import { ROLE_WEIGHT } from "@aichat/shared";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { NAV_SECTIONS } from "./nav-config";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const currentId = useWorkspaceStore((s) => s.currentId);
  const current = workspaces.find((w) => w.id === currentId) ?? null;
  const roleWeight = current ? ROLE_WEIGHT[current.member_role] : 0;

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-white"
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950">
          <MessagesSquare className="h-[18px] w-[18px] text-white" />
        </div>
        {!collapsed && (
          <span className="truncate text-[15px] font-semibold tracking-tight">
            AI Chat
          </span>
        )}
      </div>

      {/* Workspace switcher */}
      <div className="px-3 pb-1">
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {NAV_SECTIONS.map((section) => {
          const visible = section.items.filter(
            (i) => ROLE_WEIGHT[i.minRole] <= roleWeight,
          );
          if (visible.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              {!collapsed && (
                <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  {section.title}
                </p>
              )}
              {visible.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.comingSoon ? "/dashboard" : item.href}
                    title={collapsed ? item.label : undefined}
                    onMouseEnter={() => {
                      if (!item.comingSoon && !active) router.prefetch(item.href);
                    }}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900",
                      collapsed && "justify-center",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105" />
                    {!collapsed && (
                      <span className="flex-1 truncate">{item.label}</span>
                    )}
                    {!collapsed && item.comingSoon && (
                      <Lock className="h-3 w-3 text-zinc-300" />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border p-3">
        <button
          onClick={toggle}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900",
            collapsed && "justify-center",
          )}
        >
          <ChevronsLeft
            className={cn(
              "h-[18px] w-[18px] transition-transform duration-200",
              collapsed && "rotate-180",
            )}
          />
          {!collapsed && <span>Ciutkan</span>}
        </button>
      </div>
    </motion.aside>
  );
}
