import { create } from "zustand";
import type { MemberRole, WorkspaceWithRole } from "@aichat/shared";
import { ROLE_WEIGHT } from "@aichat/shared";

const STORAGE_KEY = "aichat_workspace_id";

function readStoredId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

function persistId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(STORAGE_KEY, id);
  else window.localStorage.removeItem(STORAGE_KEY);
}

interface WorkspaceState {
  workspaces: WorkspaceWithRole[];
  currentId: string | null;
  /** Replace the workspace list and resolve the active workspace. */
  setWorkspaces: (list: WorkspaceWithRole[]) => void;
  /** Switch the active workspace. */
  setCurrentId: (id: string) => void;
  reset: () => void;
  /** The active workspace, or null. */
  current: () => WorkspaceWithRole | null;
  /** True when the active workspace role meets the minimum. */
  can: (minimum: MemberRole) => boolean;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentId: null,

  setWorkspaces: (list) => {
    const stored = get().currentId ?? readStoredId();
    const exists = list.some((w) => w.id === stored);
    const nextId = exists ? stored : (list[0]?.id ?? null);
    persistId(nextId);
    set({ workspaces: list, currentId: nextId });
  },

  setCurrentId: (id) => {
    persistId(id);
    set({ currentId: id });
  },

  reset: () => {
    persistId(null);
    set({ workspaces: [], currentId: null });
  },

  current: () => {
    const { workspaces, currentId } = get();
    return workspaces.find((w) => w.id === currentId) ?? null;
  },

  can: (minimum) => {
    const ws = get().current();
    if (!ws) return false;
    return ROLE_WEIGHT[ws.member_role] >= ROLE_WEIGHT[minimum];
  },
}));
