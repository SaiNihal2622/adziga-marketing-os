// Adziga — Cleanup test orgs created during E2E verification
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const testOrgs = await p.organization.findMany({
  where: { name: { startsWith: "Welcome Test" } },
  select: { id: true, name: true }
});
for (const org of testOrgs) {
  await p.user.deleteMany({ where: { memberships: { some: { orgId: org.id } } } });
  await p.organization.delete({ where: { id: org.id } });
  console.log("Deleted test org:", org.name);
}
await p.$disconnect();
