// Adziga — Provision agents for a new org.
// Called from the signup flow so every new client gets the full agent team
// out of the box. The team can disable, rename, or restrict permissions per org.

import { prisma } from "@/lib/db";
import { AGENT_TEMPLATES } from "./templates";

export async function provisionDefaultAgents(orgId: string): Promise<void> {
  for (const t of AGENT_TEMPLATES) {
    await prisma.agent.create({
      data: {
        orgId,
        name: t.name,
        role: t.role,
        description: t.description,
        systemPrompt: t.systemPrompt,
        permissions: t.permissions,
        tools: t.tools,
        trigger: t.trigger,
        cronExpr: t.cronExpr ?? null,
        triggerEvent: t.triggerEvent ?? null,
        enabled: true
      }
    });
  }
}

export async function provisionClientAgents(orgId: string, clientId: string): Promise<void> {
  // For a per-client deployment, clone the global templates but scope them
  // to the single client. Used when Adziga takes on a new big account and
  // wants dedicated agents (vs shared agents for the agency).
  for (const t of AGENT_TEMPLATES) {
    await prisma.agent.create({
      data: {
        orgId,
        clientId,
        name: `${t.name} (Client)`,
        role: t.role,
        description: `${t.description} — scoped to this client.`,
        systemPrompt: t.systemPrompt,
        permissions: t.permissions,
        tools: t.tools,
        trigger: t.trigger,
        cronExpr: t.cronExpr ?? null,
        triggerEvent: t.triggerEvent ?? null,
        enabled: true
      }
    });
  }
}
