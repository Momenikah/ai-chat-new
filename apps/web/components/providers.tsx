"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/query-client";
import { TopProgressBar } from "@/components/top-progress-bar";

/** Wraps the app with TanStack Query (and future client providers). */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TopProgressBar />
      {children}
    </QueryClientProvider>
  );
}
