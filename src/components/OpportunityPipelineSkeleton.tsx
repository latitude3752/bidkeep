/** Route-level loading state for the opportunities pipeline, shown by
 * Next.js while the server component's one-time row fetch is in flight.
 * Shaped like the real page (header line, filter-chip rows, table) so the
 * swap-in doesn't jump the layout, using a plain CSS pulse rather than a
 * spinner since the content structure itself is the useful signal here. */
export default function OpportunityPipelineSkeleton() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-12" aria-busy="true" aria-live="polite">
      <div className="flex items-start justify-between gap-4">
        <div className="w-full max-w-sm animate-pulse space-y-2">
          <div className="h-7 w-64 rounded bg-navy-950/10" />
          <div className="h-4 w-80 rounded bg-navy-950/10" />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-navy-950/10" />
        <div className="h-8 w-20 animate-pulse rounded-lg bg-navy-950/10" />
      </div>

      <div className="mt-6 flex flex-wrap gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-7 w-24 animate-pulse rounded-full bg-navy-950/10" />
            <div className="h-7 w-16 animate-pulse rounded-full bg-navy-950/10" />
            <div className="h-7 w-16 animate-pulse rounded-full bg-navy-950/10" />
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-navy-950/10">
        <div className="h-10 animate-pulse bg-navy-950/[0.06]" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-navy-950/10 p-3 last:border-0">
            <div className="h-4 w-full max-w-md animate-pulse rounded bg-navy-950/10" />
            <div className="h-4 w-24 animate-pulse rounded bg-navy-950/10" />
            <div className="h-4 w-16 animate-pulse rounded bg-navy-950/10" />
          </div>
        ))}
      </div>
    </section>
  );
}
