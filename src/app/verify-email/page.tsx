import { verifyEmail } from "@/server/services/auth-service";
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
    <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
      <div className="card p-8 max-w-md w-full text-center">
        {state === "success" && (
          <>
            <div className="text-5xl mb-4">✓</div>
            <h1 className="text-xl font-bold mb-2">Email verified</h1>
            <p className="text-sm text-ink-600 mb-6">{message}</p>
            <Link href="/login" className="btn btn-primary">Sign in</Link>
          </>
        )}
        {state === "error" && (
          <>
            <div className="text-5xl mb-4 text-danger-500">✕</div>
            <h1 className="text-xl font-bold mb-2">Verification failed</h1>
            <p className="text-sm text-ink-600 mb-6">{message}</p>
            <Link href="/login" className="btn btn-secondary">Back to login</Link>
          </>
        )}
      </div>
    </div>
  );
}