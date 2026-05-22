/**
 * Route-level loading UI for the dashboard. Next.js shows this instantly
 * during navigation between dashboard pages, while the destination route
 * compiles + fetches. The shell (sidebar/topbar) is rendered by the
 * parent layout, so this only fills the main content area.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header skeleton */}
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded-md bg-zinc-200/70" />
          <div className="h-3.5 w-72 animate-pulse rounded-md bg-zinc-200/60" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-lg bg-zinc-200/60" />
      </div>

      {/* Stat row skeleton */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-zinc-200/70 bg-white"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>

      {/* Content card skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl border border-zinc-200/70 bg-white"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
