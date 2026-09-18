import { ResetForm } from "./form";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset your password" };

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? "";
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
      <div className="card p-8 max-w-md w-full">
        <Link href="/" className="flex items-center gap-2 mb-6 justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 13L9 7L13 11L21 3" stroke="#243ff0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="7" r="2" fill="#243ff0" />
            <circle cx="13" cy="11" r="2" fill="#243ff0" />
            <circle cx="21" cy="3" r="2" fill="#d946ef" />
          </svg>
          <span className="font-semibold">Adziga</span>
        </Link>
        <h1 className="text-xl font-bold mb-1">Reset your password</h1>
        <p className="text-sm text-ink-500 mb-6">Choose a new password for your account.</p>
        <ResetForm token={token} />
      </div>
    </div>
  );
}