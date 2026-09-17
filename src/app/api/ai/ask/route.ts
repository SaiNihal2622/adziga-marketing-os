import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { askAssistant } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { cpl, roas } from "@/lib/format";

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { question, clientId } = await req.json();
  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }

  // Build controlled context (only authorized data, scoped to org + optional client)
  const where: any = { orgId: session.orgId };
  if (clientId) where.clientId = clientId;
  const campaigns = await prisma.campaign.findMany({ where });
  const clients = await prisma.client.findMany({ where: { orgId: session.orgId, ...(clientId ? { id: clientId } : {}) } });
  const reports = await prisma.report.findMany({
    where: { orgId: session.orgId, ...(clientId ? { clientId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 3
  });

  const totalSpend = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalLeads = campaigns.reduce((s, c) => s + Number(c.leads), 0);
  const totalCustomers = campaigns.reduce((s, c) => s + Number(c.customers), 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);

  const result = await askAssistant({
    orgId: session.orgId,
    userId: session.userId,
    clientId,
    campaignIds: campaigns.map((c) => c.id),
    question,
    client: clients[0] ? { id: clients[0].id, businessName: clients[0].businessName, industry: clients[0].industry } : null,
    campaignStats: campaigns.slice(0, 20).map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      spend: c.spent,
      leads: Number(c.leads),
      cpl: c.spent / Math.max(1, Number(c.leads)),
      status: c.status
    })),
    kpis: {
      cpl: cpl(totalSpend, totalLeads),
      cac: totalCustomers ? totalSpend / totalCustomers : 0,
      roas: roas(totalRevenue, totalSpend),
      conversion: totalLeads ? (totalCustomers / totalLeads) * 100 : 0
    },
    reports: reports.map((r) => ({
      title: r.title,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      executiveSummary: r.executiveSummary
    }))
  });

  return NextResponse.json({ response: result.response, model: result.model, latencyMs: result.latencyMs });
}