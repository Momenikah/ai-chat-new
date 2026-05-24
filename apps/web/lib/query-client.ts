import { QueryClient } from "@tanstack/react-query";
import { ApiException } from "./api";

/** A QueryClient factory with sane SaaS defaults. */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Never retry auth/validation failures.
          if (error instanceof ApiException && error.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
      },
    },
  });
}
