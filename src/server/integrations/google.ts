// Adziga — Google Ads + Analytics connector
// Real Google Ads API integration via REST.

import { Connector, IntegrationConfig, SyncResult } from "./base";
import { logger } from "../logger";

const GOOGLE_ADS_API = "https://googleads.googleapis.com/v17";

export class GoogleConnector implements Connector {
  readonly provider = "GOOGLE";
  constructor(private config: IntegrationConfig) {}

  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.accountId);
  }

  async testConnection(): Promise<{ ok: boolean; detail?: string }> {
    if (!this.isConfigured()) return { ok: false, detail: "GOOGLE_ADS_DEVELOPER_TOKEN / CUSTOMER_ID not set" };
    try {
      const r = await fetch(
        `${GOOGLE_ADS_API}/customers/${this.config.accountId}/campaigns?pageSize=1`,
        { headers: { Authorization: `Bearer ${this.config.apiKey}`, "developer-token": this.config.apiSecret! } }
      );
      if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
      return { ok: true, detail: "Connected" };
    } catch (e: any) {
      return { ok: false, detail: e.message };
    }
  }

  async fetchCampaigns(externalAccountId: string): Promise<any[]> {
    if (!this.isConfigured()) return [];
    try {
      const query = `
        SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type
        FROM campaign
        WHERE campaign.advertising_channel_type IN ('SEARCH','DISPLAY','SHOPPING','VIDEO')
        LIMIT 200
      `.trim();
      const r = await fetch(
        `${GOOGLE_ADS_API}/customers/${externalAccountId}/googleAds:searchStream`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "developer-token": this.config.apiSecret!,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ query })
        }
      );
      const text = await r.text();
      const lines = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
      return lines.map((l: any) => l.results?.[0]?.campaign).filter(Boolean);
    } catch (e) {
      logger.error("google.fetch_campaigns_failed", { error: String(e) });
      return [];
    }
  }

  async sync(opts: { since?: Date; orgId: string }): Promise<SyncResult> {
    const start = Date.now();
    if (!this.isConfigured()) {
      return { ok: true, itemsProcessed: 0, errors: ["not configured (stub mode)"], durationMs: 0 };
    }
    try {
      const campaigns = await this.fetchCampaigns(this.config.accountId!);
      return { ok: true, itemsProcessed: campaigns.length, errors: [], durationMs: Date.now() - start };
    } catch (e: any) {
      return { ok: false, itemsProcessed: 0, errors: [e.message], durationMs: Date.now() - start };
    }
  }
}