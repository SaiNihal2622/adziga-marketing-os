// Adziga — Meta Marketing API connector
// Uses Meta Graph API. Real implementation. Falls back to stub if no credentials.

import { Connector, IntegrationConfig, SyncResult, SendMessageInput, SendMessageResult } from "./base";
import { logger } from "../logger";

const META_GRAPH = "https://graph.facebook.com/v19.0";

export class MetaConnector implements Connector {
  readonly provider = "META";
  constructor(private config: IntegrationConfig) {}

  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.accountId);
  }

  async testConnection(): Promise<{ ok: boolean; detail?: string }> {
    if (!this.isConfigured()) return { ok: false, detail: "META_ACCESS_TOKEN / AD_ACCOUNT_ID not set" };
    try {
      const r = await fetch(
        `${META_GRAPH}/act_${this.config.accountId}?fields=name,account_status&access_token=${this.config.apiKey}`
      );
      const j: any = await r.json();
      if (!r.ok || j.error) return { ok: false, detail: j.error?.message ?? `HTTP ${r.status}` };
      return { ok: true, detail: `Account: ${j.name} (${j.account_status})` };
    } catch (e: any) {
      logger.error("meta.test_failed", { error: e.message });
      return { ok: false, detail: e.message };
    }
  }

  async fetchCampaigns(externalAccountId: string): Promise<any[]> {
    if (!this.isConfigured()) return [];
    try {
      const r = await fetch(
        `${META_GRAPH}/act_${externalAccountId}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget&access_token=${this.config.apiKey}&limit=200`
      );
      const j: any = await r.json();
      return j.data ?? [];
    } catch (e) {
      logger.error("meta.fetch_campaigns_failed", { error: String(e) });
      return [];
    }
  }

  async fetchLeads(externalAccountId: string, since?: Date): Promise<any[]> {
    if (!this.isConfigured()) return [];
    try {
      const params = new URLSearchParams({
        fields: "id,created_time,field_data,ad_id,adset_id,campaign_id",
        access_token: this.config.apiKey!,
        limit: "500"
      });
      if (since) params.set("since", String(Math.floor(since.getTime() / 1000)));
      const r = await fetch(`${META_GRAPH}/act_${externalAccountId}/leadgen_forms?${params}`);
      const forms: any = await r.json();
      const out: any[] = [];
      for (const form of forms.data ?? []) {
        const leadsR = await fetch(`${META_GRAPH}/${form.id}/leads?access_token=${this.config.apiKey}&limit=500`);
        const leads: any = await leadsR.json();
        out.push(...(leads.data ?? []));
      }
      return out;
    } catch (e) {
      logger.error("meta.fetch_leads_failed", { error: String(e) });
      return [];
    }
  }

  async sync(opts: { since?: Date; orgId: string }): Promise<SyncResult> {
    const start = Date.now();
    const errors: string[] = [];
    let processed = 0;
    if (!this.isConfigured()) {
      return { ok: true, itemsProcessed: 0, errors: ["not configured (stub mode)"], durationMs: 0 };
    }
    try {
      const campaigns = await this.fetchCampaigns(this.config.accountId!);
      processed += campaigns.length;
      const leads = await this.fetchLeads(this.config.accountId!, opts.since);
      processed += leads.length;
    } catch (e: any) {
      errors.push(e.message);
    }
    return { ok: errors.length === 0, itemsProcessed: processed, errors, durationMs: Date.now() - start };
  }
}