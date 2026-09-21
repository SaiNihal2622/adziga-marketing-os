// Adziga — App-wide loading state (Next.js automatic Suspense fallback)

export default function Loading() {
  return (
    <div className="space-y-6 fade-in" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 bg-ink-100 rounded animate-pulse" />
        <div className="h-6 w-24 bg-ink-100 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-v0 p-5 space-y-3">
            <div className="h-3 w-20 bg-ink-100 rounded animate-pulse" />
            <div className="h-7 w-28 bg-ink-100 rounded animate-pulse" />
            <div className="h-3 w-16 bg-ink-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="card-v0 p-5 h-64 bg-ink-50/30 animate-pulse" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card-v0 p-5 h-40 bg-ink-50/30 animate-pulse" />
        <div className="card-v0 p-5 h-40 bg-ink-50/30 animate-pulse" />
      </div>
    </div>
  );
}
