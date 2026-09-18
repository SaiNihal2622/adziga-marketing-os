import { z } from "zod";
import { publicRoute } from "@/server/api";
import { requestPasswordReset } from "@/server/services/auth-service";

const schema = z.object({ email: z.string().email() });

export const POST = publicRoute(schema, async (_ctx, body) => {
  await requestPasswordReset(body.email);
  return { ok: true };
});