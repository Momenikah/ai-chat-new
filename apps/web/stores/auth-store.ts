import { create } from "zustand";
import type { User } from "@aichat/shared";

interface AuthState {
  user: User | null;
  hydrated: boolean;
  setUser: (user: User | null) => void;
  setHydrated: (hydrated: boolean) => void;
  reset: () => void;
}

/** Holds the authenticated user. Workspace role lives in workspace-store. */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  setUser: (user) => set({ user }),
  setHydrated: (hydrated) => set({ hydrated }),
  reset: () => set({ user: null, hydrated: false }),
}));
