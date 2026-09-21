// /api/creatives/generate-image — AI image generation via Gemini
//
// Uses Gemini 2.0 Flash (experimental image output) when available; falls
// back to a deterministic placeholder image (gradient SVG with the brief
// text) if Gemini is unavailable or doesn't return image bytes.
//
// Returns: { creative: { mediaUrl, ... }, model, warning? }
// The asset is auto-uploaded via the storage layer and a Creative record
// is created in DRAFT status with source="AI_GENERATED".
import { randomUUID } from "node:crypto";
import { authedRoute } from "@/server/api";
import { generateImageSchema } from "@/server/schemas";
import { saveAsset } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 90;
export const runtime = "nodejs";

const STYLE_HINTS: Record<string, string> = {
  photoreal: "ultra-realistic photography, natural lighting, high detail, 8k",
  studio: "studio lighting, clean background, product hero shot, commercial photography",
  lifestyle: "lifestyle photography, candid, in-context, real-world setting",
  ugc_phone_shot: "shot on phone, natural, slightly imperfect, authentic UGC feel",
  flat_lay: "flat lay, top-down view, arranged composition, soft shadows",
  infographic: "infographic, data visualization, clean typography, brand colors"
};

const ASPECT_RATIO_TO_SIZE: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "4:5": { width: 1024, height: 1280 },
  "9:16": { width: 1024, height: 1820 },
  "16:9": { width: 1820, height: 1024 }
};

export const POST = authedRoute(generateImageSchema, async (ctx, body) => {
  const aspectRatio = body.aspectRatio ?? "1:1";
  const platform = body.platform ?? "META";
  const style = body.style ?? "studio";
  const apiKey = process.env.GEMINI_API_KEY?.replace(/[^\x20-\x7E]/g, "").trim();

  let imageBuffer: Buffer | null = null;
  let model = "adziga-placeholder-v1";
  let warning: string | undefined;

  if (apiKey) {
    try {
      const { width, height } = ASPECT_RATIO_TO_SIZE[aspectRatio] ?? ASPECT_RATIO_TO_SIZE["1:1"]!;
      const prompt = `${body.brief}. ${STYLE_HINTS[style] ?? STYLE_HINTS.studio}. Professional marketing creative, ${platform} ready. No text overlays, no logos.`;
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 75_000);
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.9,
                responseModalities: ["TEXT", "IMAGE"],
                imageConfig: { aspectRatio }
              }
            }),
            signal: ctrl.signal
          }
        );
        if (r.ok) {
          const data = await r.json();
          const inlineData = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
          if (inlineData?.data) {
            imageBuffer = Buffer.from(inlineData.data, "base64");
            model = "gemini-2.0-flash-exp";
          } else {
            warning = "Gemini returned no image bytes — serving placeholder";
          }
        } else {
          const err = await r.text();
          console.error("gemini_image_http_error", r.status, err.slice(0, 300));
          warning = `Gemini image ${r.status} — serving placeholder`;
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (e: any) {
      console.error("gemini_image_failed", e);
      warning = `Gemini image error — serving placeholder`;
    }
  } else {
    warning = "GEMINI_API_KEY not set — serving placeholder";
  }

  if (!imageBuffer) {
    // Deterministic placeholder so the user always gets SOMETHING they can
    // save and iterate on. A branded gradient + brief label, sized for the
    // requested aspect ratio.
    const size = ASPECT_RATIO_TO_SIZE[aspectRatio] ?? ASPECT_RATIO_TO_SIZE["1:1"]!;
    imageBuffer = Buffer.from(renderPlaceholderSvg(size.width, size.height, body.brief, style), "utf8");
  }

  const fileName = `${randomUUID()}.${model.startsWith("gemini") ? "png" : "svg"}`;
  const asset = await saveAsset({
    orgId: ctx.orgId,
    buffer: imageBuffer,
    mimeType: model.startsWith("gemini") ? "image/png" : "image/svg+xml",
    originalName: fileName,
    folder: "ai-generated"
  });

  const creative = await ctx.prisma.creative.create({
    data: {
      orgId: ctx.orgId,
      campaignId: body.campaignId,
      name: body.brief.slice(0, 60),
      format: "IMAGE",
      platform,
      primaryCopy: body.brief,
      mediaUrl: asset.url,
      thumbnailUrl: asset.url,
      source: "AI_GENERATED",
      creator: "AI (" + model + ")",
      status: "DRAFT"
    }
  });

  return { creative, model, warning };
});

function renderPlaceholderSvg(width: number, height: number, brief: string, style: string): string {
  // Brand colors (#f36d21 orange, #0a0a0a ink) — gradient placeholder.
  const truncated = brief.length > 80 ? brief.slice(0, 77) + "…" : brief;
  const labelLines = wrapText(truncated, 30);
  const lineY = (i: number) => height / 2 - labelLines.length * 18 + i * 36;
  const fontSize = Math.max(28, Math.min(width, height) / 18);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f36d21"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <rect x="${width * 0.08}" y="${height * 0.08}" width="${width * 0.84}" height="${height * 0.84}"
        fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-dasharray="12 8" rx="16"/>
  <text x="${width / 2}" y="${height * 0.18}" text-anchor="middle" fill="rgba(255,255,255,0.7)"
        font-family="ui-sans-serif, system-ui, -apple-system" font-size="${Math.max(14, fontSize * 0.5)}" font-weight="600"
        letter-spacing="2">ADZIGA · PLACEHOLDER · ${style.toUpperCase()}</text>
  ${labelLines.map((line, i) => `<text x="${width / 2}" y="${lineY(i)}" text-anchor="middle" fill="white" font-family="ui-sans-serif, system-ui, -apple-system" font-size="${fontSize}" font-weight="700">${escapeXml(line)}</text>`).join("\n  ")}
</svg>`;
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxCharsPerLine) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + " " + w : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}
