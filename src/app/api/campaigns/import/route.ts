// Adziga — /api/campaigns/import
// Sprint 12a — bulk CSV import of campaigns. Accepts a CSV body with
// columns: clientName|businessName, name, platform, objective, budget,
// startDate, endDate, externalId, notes.
//
// Auth: FOUNDER/ADMIN only.
//
// Body is raw text (Content-Type: text/csv). Returns a structured
// summary with accepted rows and per-row errors.

import { authedRoute } from "@/server/api";
import { Role } from "@/lib/constants";
import { prisma } from "@/lib/db";

export const POST = authedRoute(null, async (ctx) => {
  if (ctx.role !== Role.FOUNDER && ctx.role !== Role.ADMIN) {
    return { error: "FOUNDER or ADMIN required" } as any;
  }
  const body = await ctx.req.text();
  if (!body.trim()) return { error: "empty body" } as any;

  const lines = body.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return { error: "CSV needs a header row + at least one data row" } as any;

  const headerLine = lines[0].toLowerCase().split(",").map((c) => c.trim());
  const accepted: any[] = [];
  const errors: Array<{ line: number; reason: string }> = [];

  // Lazy-load clients by name; cache for the batch.
  const clients = await prisma.client.findMany({
    where: { orgId: ctx.orgId },
    select: { id: true, businessName: true }
  });
  const clientByName = new Map(clients.map((c) => [c.businessName.toLowerCase(), c.id]));

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length < 5) {
      errors.push({ line: i + 1, reason: "too few columns (need ≥5: clientName,name,platform,objective,budget)" });
      continue;
    }
    const row: Record<string, string> = {};
    headerLine.forEach((h, idx) => { row[h] = cols[idx] ?? ""; });

    const clientId = clientByName.get((row["clientname"] ?? row["businessname"] ?? "").toLowerCase());
    if (!clientId) {
      errors.push({ line: i + 1, reason: `unknown client "${row["clientname"] ?? row["businessname"]}"` });
      continue;
    }
    if (!row["name"]) {
      errors.push({ line: i + 1, reason: "missing campaign name" });
      continue;
    }
    const platform = (row["platform"] ?? "").toUpperCase();
    const validPlatforms = ["META", "GOOGLE", "YOUTUBE", "INSTAGRAM", "WHATSAPP", "LINKEDIN", "TWITTER", "EMAIL", "INFLUENCER", "EVENT"];
    if (!validPlatforms.includes(platform)) {
      errors.push({ line: i + 1, reason: `invalid platform "${row["platform"]}" (expected one of: ${validPlatforms.join(", ")})` });
      continue;
    }
    if (!row["objective"]) {
      errors.push({ line: i + 1, reason: "missing objective" });
      continue;
    }
    const budget = Number(row["budget"] ?? 0);
    if (!Number.isFinite(budget) || budget < 0) {
      errors.push({ line: i + 1, reason: "budget must be a non-negative number" });
      continue;
    }
    accepted.push({
      orgId: ctx.orgId,
      clientId,
      name: row["name"],
      platform,
      objective: row["objective"],
      budget,
      spent: 0,
      startDate: row["startdate"] ? new Date(row["startdate"]) : null,
      endDate: row["enddate"] ? new Date(row["enddate"]) : null,
      externalId: row["externalid"] || null,
      notes: row["notes"] || null,
      status: "DRAFT"
    });
  }

  if (accepted.length === 0) {
    return { accepted: 0, rejected: errors.length, errors };
  }

  await prisma.campaign.createMany({ data: accepted });
  return { accepted: accepted.length, rejected: errors.length, errors };
});
