import { z } from "zod";
import { publicRoute } from "@/server/api";
import { signup } from "@/server/services/auth-service";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().max(200).optional(),
  orgName: z.string().min(1).max(200)
});

export const POST = publicRoute(schema, async (_ctx, body) => {
  const r = await signup(body);
  return { ok: true, userId: r.userId, orgId: r.orgId };
});