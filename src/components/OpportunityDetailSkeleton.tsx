/** Route-level loading state for a single opportunity's detail page.
 * Kept separate from OpportunityPipelineSkeleton (the list view) so a
 * direct/hard navigation into /opportunities/[id] doesn't briefly show a
 * table-shaped skeleton for what's actually a single-record page -- Next
 * applies the nearest loading.tsx to nested dynamic segments too, so this
 * segment needs its own. */
export default function OpportunityDetailSkeleton() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-12" aria-busy="true" aria-live="polite">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-32 rounded bg-navy-950/10" />
        <div className="h-8 w-full max-w-xl rounded bg-navy-950/10" />
        <div className="h-4 w-48 rounded bg-navy-950/10" />
      </div>
      <div className="mt-8 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-2 rounded-xl border border-navy-950/10 p-4">
            <div className="h-3 w-24 rounded bg-navy-950/10" />
            <div className="h-4 w-full rounded bg-navy-950/10" />
          </div>
        ))}
      </div>
    </section>
  );
}
