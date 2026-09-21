// POST /api/uploads — multipart file upload for creatives, briefs, avatars.
//
// Returns the asset metadata. The caller (route handler / form) is
// responsible for creating a Creative / Brief / User record that points
// at the asset URL.
import { z } from "zod";
import { authedRoute } from "@/server/api";
import { saveAsset, ALLOWED_MIME, MAX_BYTES } from "@/lib/storage";

export const runtime = "nodejs"; // Buffer.from / fs needs node, not edge
export const dynamic = "force-dynamic";

const uploadSchema = z.object({
  folder: z.enum(["creatives", "briefs", "ai-generated", "avatars", "general"]).optional()
});

export const POST = authedRoute(uploadSchema, async (ctx, body) => {
  const formData = await ctx.req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw Object.assign(new Error("Missing 'file' field in multipart payload"), { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw Object.assign(new Error(`Unsupported file type: ${file.type || "unknown"}`), { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    throw Object.assign(new Error(`File too large: ${file.size} bytes (max ${MAX_BYTES})`), { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const asset = await saveAsset({
    orgId: ctx.orgId,
    buffer,
    mimeType: file.type || "application/octet-stream",
    originalName: file.name || "upload.bin",
    folder: body.folder ?? "general"
  });

  return {
    ok: true,
    asset: {
      key: asset.key,
      url: asset.url,
      bytes: asset.bytes,
      mimeType: asset.mimeType,
      originalName: asset.originalName
    }
  };
});
