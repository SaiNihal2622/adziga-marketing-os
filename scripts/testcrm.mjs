import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
async function main() {
  // test the same query
  const orgs = await p.organization.findFirst({ where: { slug: "adziga" } });
  console.log("org", orgs.id);
  const customers = await p.customer.findMany({
    where: { orgId: orgs.id },
    include: { client: true, lead: { include: { campaign: true } } },
    take: 5
  });
  console.log("customers found:", customers.length);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());