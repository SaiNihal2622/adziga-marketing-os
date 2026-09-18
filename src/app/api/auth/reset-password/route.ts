import { z } from "zod";
import { publicRoute } from "@/server/api";
import { resetPassword } from "@/server/services/auth-service";

const schema = z.object({
  token: z.string().min(8),
  password: z.string().min(8).max(200)
});

export const POST = publicRoute(schema, async (_ctx, body) => {
  await resetPassword(body.token, body.password);
  return { ok: true };
});