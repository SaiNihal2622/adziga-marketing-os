// /api/files/[...path] — stream uploaded files back to the browser.
//
// On Vercel the filesystem is read-only, so uploads go to /tmp and are
// served via this route. On local dev, files live under public/uploads
// and are served by Next.js directly (this route is never hit).
//
// Auth: requires a session. Files are org-scoped (the path starts with
// the caller's orgId) so we never serve a file from a different org.
import { authedRoute } from "@/server/api";
import { readFile, stat } from "node:fs/promises";
import { resolve, join, sep } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".txt": "text/plain"
};

export const GET = authedRoute(null, async (ctx, _data, params) => {
  if (process.env.VERCEL !== "1") {
    // Local dev — fall back to public/uploads via a 302 to keep the same
    // URL shape, but really Next.js serves these directly.
    return new Response(null, { status: 302, headers: { Location: `/uploads/${(params as any).path?.join("/")}` } });
  }
  const segments = ((params as any).path as string[]) ?? [];
  if (segments.length < 2) return new Response("Not found", { status: 404 });
  // Sanitize — no `..`, no absolute paths
  if (segments.some((s) => s.includes("..") || s.includes("/") || s.includes("\\"))) {
    return new Response("Bad path", { status: 400 });
  }
  const key = segments.join("/");
  // Org scoping: the first segment must match ctx.orgId
  if (segments[0] !== ctx.orgId) {
    return new Response("Forbidden", { status: 403 });
  }
  const filePath = resolve("/tmp", "uploads", key);
  if (!filePath.startsWith(resolve("/tmp", "uploads"))) {
    return new Response("Bad path", { status: 400 });
  }
  let buffer: Buffer;
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) return new Response("Not found", { status: 404 });
    buffer = await readFile(filePath);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  // Detect MIME from extension
  const ext = "." + key.split(".").pop()?.toLowerCase();
  const mime = ALLOWED_MIME[ext] ?? "application/octet-stream";
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=60",
      "Content-Length": String(buffer.length)
    }
  });
});
