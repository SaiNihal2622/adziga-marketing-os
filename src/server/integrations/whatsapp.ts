// Adziga — WhatsApp Business API connector (uses Meta Graph API)

import { Connector, IntegrationConfig, SyncResult, SendMessageInput, SendMessageResult } from "./base";
import { logger } from "../logger";

const WA_GRAPH = "https://graph.facebook.com/v19.0";

export class WhatsAppConnector implements Connector {
  readonly provider = "WHATSAPP";
  constructor(private config: IntegrationConfig) {}

  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.accountId);
  }

  async testConnection(): Promise<{ ok: boolean; detail?: string }> {
    if (!this.isConfigured()) return { ok: false, detail: "WHATSAPP_API_TOKEN / PHONE_NUMBER_ID not set" };
    try {
      const r = await fetch(
        `${WA_GRAPH}/${this.config.accountId}?fields=verified_name,display_phone_number&access_token=${this.config.apiKey}`
      );
      const j: any = await r.json();
      if (!r.ok || j.error) return { ok: false, detail: j.error?.message ?? `HTTP ${r.status}` };
      return { ok: true, detail: `${j.verified_name} (${j.display_phone_number})` };
    } catch (e: any) {
      return { ok: false, detail: e.message };
    }
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    if (!this.isConfigured()) {
      logger.warn("whatsapp.stub_send", { to: input.to, template: input.template });
      return { ok: true, messageId: "stub-" + Date.now() };
    }
    try {
      const body: any = {
        messaging_product: "whatsapp",
        to: input.to,
        type: "template",
        template: {
          name: input.template,
          language: { code: "en" },
          components: input.variables
            ? [{ type: "body", parameters: Object.values(input.variables).map((v) => ({ type: "text", text: v })) }]
            : []
        }
      };
      const r = await fetch(`${WA_GRAPH}/${this.config.accountId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const j: any = await r.json();
      if (!r.ok || j.error) return { ok: false, error: j.error?.message ?? `HTTP ${r.status}` };
      return { ok: true, messageId: j.messages?.[0]?.id };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  async sync(opts: { since?: Date; orgId: string }): Promise<SyncResult> {
    if (!this.isConfigured()) {
      return { ok: true, itemsProcessed: 0, errors: ["not configured (stub mode)"], durationMs: 0 };
    }
    // WhatsApp has no inbound "sync" — messages are pushed via webhook
    return { ok: true, itemsProcessed: 0, errors: [], durationMs: 0 };
  }
}