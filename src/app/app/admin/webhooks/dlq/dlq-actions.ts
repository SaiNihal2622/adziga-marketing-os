// Adziga — DLQ server actions (Sprint 16d)
// Two admin actions on the dead-letter queue page:
//   - retryDelivery: hit /api/admin/webhooks/[id]/retry
//   - resolveDelivery: hit /api/admin/webhooks/[id]/resolve
// Both refresh the page after so the table reflects new state.

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/session";
import { cookies } from "next/headers";

export async function retryDelivery(formData: FormData) {
  const session = await requireRole([Role.FOUNDER, Role.ADMIN]);
  const id = String(formData.get("id"));
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const cookie = cookies().toString();
  await fetch(`${baseUrl}/api/admin/webhooks/${id}/retry`, {
    method: "POST",
    headers: { Cookie: cookie },
    cache: "no-store"
  }).catch(() => null);
  await audit(session.orgId, session.userId, "webhook.retry_dlq", {
    entityType: "WebhookDelivery",
    entityId: id
  });
  revalidatePath("/app/admin/webhooks/dlq");
  revalidatePath("/app/admin/webhooks");
}

export async function resolveDelivery(formData: FormData) {
  const session = await requireRole([Role.FOUNDER, Role.ADMIN]);
  const id = String(formData.get("id"));
  const note = String(formData.get("note") ?? "").trim() || undefined;
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const cookie = cookies().toString();
  await fetch(`${baseUrl}/api/admin/webhooks/${id}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ note }),
    cache: "no-store"
  }).catch(() => null);
  revalidatePath("/app/admin/webhooks/dlq");
  revalidatePath("/app/admin/webhooks");
}

export async function purgeResolved(formData: FormData) {
  const session = await requireRole([Role.FOUNDER, Role.ADMIN]);
  // Remove deliveries that have been resolved/processed from the DLQ
  // perspective (status=processed AND previously dead-lettered).
  const result = await prisma.webhookDelivery.deleteMany({
    where: { status: "processed", deadLetteredAt: { not: null } }
  });
  await audit(session.orgId, session.userId, "webhook.dlq_purge", {
    entityType: "WebhookDelivery",
    after: { deletedCount: result.count }
  });
  revalidatePath("/app/admin/webhooks/dlq");
}
