// Adziga — Cleanup test orgs created during E2E agent verification.
// Targets orgs whose name starts with "Saree India", "Welcome Test",
// "Agent Test", "Debug Test".
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const testOrgs = await p.organization.findMany({
  where: {
    name: {
      startsWith: "Saree India"
    }
  },
  select: { id: true, name: true }
});
for (const org of testOrgs) {
  // Cascade-delete everything tied to the org
  await p.agentAction.deleteMany({ where: { orgId: org.id } });
  await p.agentRun.deleteMany({ where: { orgId: org.id } });
  await p.agentMessage.deleteMany({ where: { thread: { orgId: org.id } } });
  await p.agentThread.deleteMany({ where: { orgId: org.id } });
  await p.competitorAd.deleteMany({ where: { orgId: org.id } });
  await p.actAsSession.deleteMany({ where: { orgId: org.id } });
  await p.agent.deleteMany({ where: { orgId: org.id } });
  await p.user.deleteMany({ where: { memberships: { some: { orgId: org.id } } } });
  await p.organization.delete({ where: { id: org.id } });
  console.log("Deleted test org:", org.name);
}
await p.$disconnect();
