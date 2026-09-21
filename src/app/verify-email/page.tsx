import { verifyEmail } from "@/server/services/auth-service";
import { Logo } from "@/components/brand/logo";
import Link from "next/link";

export const dynamic = "force-dynamic";

type VerifyState = "pending" | "success" | "error";

async function resolveVerification(token: string): Promise<{ state: VerifyState; message: string }> {
  if (!token) return { state: "error", message: "No token provided." };
  try {
    await verifyEmail(token);
    return { state: "success", message: "Your email has been verified. You can now sign in." };
  } catch (e: any) {
    return { state: "error", message: e?.message ?? "Verification failed" };
  }
}

export default async function VerifyEmailPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? "";
  const { state, message } = await resolveVerification(token);

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      <aside className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-ink-950 text-white">
        <div className="absolute inset-0 bg-bento opacity-30" />
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-brand-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent-500/30 rounded-full blur-3xl" />
        <div className="relative">
          <Link href="/" className="inline-flex items-center">
            <Logo variant="icon" size={40} theme="dark" />
          </Link>
        </div>
        <div className="relative space-y-4 max-w-md">
          <h1 className="text-3xl font-bold tracking-tight leading-tight">
            Email verification.
          </h1>
          <p className="text-ink-300 text-base leading-relaxed">
            Confirming your email unlocks password resets, MFA enrollment, and team invites.
          </p>
        </div>
        <div className="relative text-xs text-ink-400">
          © {new Date().getFullYear()} Adziga · <Link href="/" className="hover:text-ink-200">adziga.in</Link>
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="lg:hidden flex items-center gap-2 mb-4 justify-center">
            <Logo variant="icon" size={36} theme="light" />
          </Link>
          <div className="space-y-6 text-center">
            {state === "success" && (
              <>
                <div className="size-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 text-2xl fade-in">
                  ✓
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Email verified</h2>
                  <p className="text-sm text-ink-500 mt-2">{message}</p>
                </div>
                <Link href="/login" className="btn btn-primary w-full justify-center">Sign in to Adziga</Link>
              </>
            )}
            {state === "error" && (
              <>
                <div className="size-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600 text-2xl fade-in">
                  ✕
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Verification failed</h2>
                  <p className="text-sm text-ink-500 mt-2">{message}</p>
                </div>
                <Link href="/login" className="btn btn-secondary w-full justify-center">Back to login</Link>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


