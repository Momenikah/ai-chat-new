/**
 * Route-level loading UI for the super-admin panel (dark theme to match
 * the /admin shell). Shows instantly during navigation while the
 * destination admin page compiles + fetches.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-md bg-zinc-800" />
        <div className="h-3.5 w-80 animate-pulse rounded-md bg-zinc-800/70" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse border-b border-zinc-800/60 bg-zinc-900"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
