import Link from "next/link";

export const metadata = {
  title: "Page not found - Adziga"
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-ink-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center fade-in">
        <p className="text-7xl font-display font-semibold text-brand-600 mb-2">404</p>
        <h1 className="text-2xl font-display font-semibold text-ink-900 mb-2">
          We couldn't find that page
        </h1>
        <p className="text-ink-600 mb-8">
          The page may have been moved, renamed, or never existed.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="btn btn-primary btn-sm">
            Back to Adziga
          </Link>
          <Link href="/app/overview" className="btn btn-ghost btn-sm">
            Open dashboard
          </Link>
        </div>
        <p className="mt-12 text-xs text-ink-500">
          Need help? Email <a href="mailto:support@adziga.in" className="hover:text-brand-600">support@adziga.in</a>
        </p>
      </div>
    </main>
  );
}
