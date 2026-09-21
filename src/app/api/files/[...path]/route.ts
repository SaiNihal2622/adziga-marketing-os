// /api/files/[...path] — stream uploaded files back to the browser.
//
// On Vercel the filesystem is read-only, so uploads go to /tmp and are
// served via this route. On local dev, files live under public/uploads
// and are served by Next.js directly (this route is never hit).
//
// Auth: PUBLIC by design — these URLs are embedded in <img src> tags
// and the browser doesn't send cookies on image requests. Security
// relies on the orgId-prefixed path: the cuid is unguessable, so a
// malicious actor would need to know both the orgId AND the random
// filename to fetch a file they don't own. This is the same security
// model as S3 / Cloudflare R2 signed-but-non-expiring URLs.
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

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

export async function GET(_req: Request, ctx: { params: { path?: string[] } }) {
  if (process.env.VERCEL !== "1") {
    return new Response(null, { status: 302, headers: { Location: `/uploads/${ctx.params.path?.join("/")}` } });
  }
  const segments = ctx.params.path ?? [];
  if (segments.length < 2) return new Response("Not found", { status: 404 });
  if (segments.some((s) => s.includes("..") || s.includes("/") || s.includes("\\"))) {
    return new Response("Bad path", { status: 400 });
  }
  const key = segments.join("/");
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
  const ext = "." + (key.split(".").pop() ?? "").toLowerCase();
  const mime = ALLOWED_MIME[ext] ?? "application/octet-stream";
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=3600",
      "Content-Length": String(buffer.length)
    }
  });
}
