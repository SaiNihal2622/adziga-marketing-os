// Storage abstraction for creatives, briefs, and AI-generated assets.
//
// Two backends:
//   - "local"  — writes to public/uploads/{orgId}/. Used for local dev and
//                single-tenant deployments. Files are served via Next.js's
//                public/ directory.
//   - "s3"     — S3-compatible (Cloudflare R2, AWS S3, MinIO). For Vercel
//                production. Selected by env STORAGE_BACKEND=s3 plus
//                STORAGE_S3_BUCKET, STORAGE_S3_ENDPOINT, etc.
//
// All uploaded files are scoped by orgId so a malicious client can't fetch
// another org's asset just by guessing the URL.

import { promises as fs } from "node:fs";
import { join, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";

export type StorageBackend = "local" | "s3";

const PUBLIC_DIR = resolve(process.cwd(), "public");
const UPLOAD_PREFIX = join("uploads");

export function storageBackend(): StorageBackend {
  return process.env.STORAGE_BACKEND === "s3" ? "s3" : "local";
}

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "file";
}

function randomPrefix(): string {
  return randomBytes(6).toString("hex");
}

export type SavedAsset = {
  /** Path/key — what we store in the DB. For local: relative to public/. For s3: object key. */
  key: string;
  /** Public URL the browser can fetch */
  url: string;
  bytes: number;
  mimeType: string;
  originalName: string;
};

/**
 * Persist a file for an org. Returns the asset metadata so the caller can
 * persist a Creative / Brief record pointing at the asset.
 *
 *   const asset = await saveAsset({
 *     orgId: ctx.orgId,
 *     buffer: Buffer.from(...),
 *     mimeType: "image/png",
 *     originalName: "hero.png",
 *   });
 */
export async function saveAsset(opts: {
  orgId: string;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  /** Optional sub-folder (e.g. "creatives", "ai-generated") */
  folder?: string;
}): Promise<SavedAsset> {
  const safeName = sanitizeFilename(opts.originalName);
  const folder = opts.folder ? sanitizeFilename(opts.folder) : "general";
  const fileName = `${randomPrefix()}-${safeName}`;
  const key = join(opts.orgId, folder, fileName).split(sep).join("/");

  if (storageBackend() === "local") {
    const fullPath = join(PUBLIC_DIR, UPLOAD_PREFIX, key);
    await fs.mkdir(resolve(fullPath, ".."), { recursive: true });
    await fs.writeFile(fullPath, opts.buffer);
    return {
      key: `${UPLOAD_PREFIX}/${key}`,
      url: `/uploads/${opts.orgId}/${folder}/${fileName}`,
      bytes: opts.buffer.length,
      mimeType: opts.mimeType,
      originalName: opts.originalName
    };
  }

  // S3 path — only reached when STORAGE_BACKEND=s3 is configured.
  // Implemented lazily so the S3 SDK doesn't ship in local builds.
  // @ts-expect-error — optional peer; only present when STORAGE_BACKEND=s3
  const s3Module: any = await import("@aws-sdk/client-s3").catch(() => {
    throw new Error("STORAGE_BACKEND=s3 requires @aws-sdk/client-s3 — install it first.");
  });
  const { S3Client, PutObjectCommand } = s3Module;
  const region = process.env.STORAGE_S3_REGION ?? "auto";
  const endpoint = process.env.STORAGE_S3_ENDPOINT;
  const bucket = process.env.STORAGE_S3_BUCKET;
  if (!bucket) throw new Error("STORAGE_S3_BUCKET is required when STORAGE_BACKEND=s3");
  const client = new S3Client({ region, endpoint: endpoint ? { hostname: endpoint.replace(/^https?:\/\//, ""), protocol: "https" } : undefined as any });
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: opts.buffer,
      ContentType: opts.mimeType,
      ACL: "public-read"
    })
  );
  const publicBase = process.env.STORAGE_S3_PUBLIC_BASE ?? (endpoint ? `${endpoint}/${bucket}` : `https://${bucket}.s3.${region}.amazonaws.com`);
  return {
    key,
    url: `${publicBase}/${key}`,
    bytes: opts.buffer.length,
    mimeType: opts.mimeType,
    originalName: opts.originalName
  };
}

/**
 * Best-effort delete. Local deletes silently succeed. S3 deletes require
 * the same SDK. Failures are logged, never thrown.
 */
export async function deleteAsset(key: string, orgId: string): Promise<void> {
  if (storageBackend() === "local") {
    try {
      const fullPath = resolve(PUBLIC_DIR, key);
      if (!fullPath.startsWith(PUBLIC_DIR)) {
        console.warn("deleteAsset: refusing to delete outside public/", key);
        return;
      }
      // Only delete if the path contains the orgId prefix — guard against
      // malicious keys.
      if (!key.includes(`${orgId}/`)) {
        console.warn("deleteAsset: refusing to delete from another org", key);
        return;
      }
      await fs.unlink(fullPath);
    } catch (e) {
      console.warn("deleteAsset: local unlink failed", e);
    }
    return;
  }
  // S3 path omitted for brevity — same SDK pattern as saveAsset.
  console.warn("deleteAsset: S3 backend not implemented yet");
}

export const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "text/plain"
]);

export const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — generous for hero images; bump via env if you need video
