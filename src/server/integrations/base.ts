// Adziga — Integration connector base interface
// All integrations implement this. Real Meta/Google/WhatsApp/Gemini connectors plug in here.

export type IntegrationConfig = {
  apiKey?: string;
  apiSecret?: string;
  accountId?: string;
  webhookUrl?: string;
  extra?: Record<string, string>;
};

export type SyncResult = {
  ok: boolean;
  itemsProcessed: number;
  errors: string[];
  durationMs: number;
};

export type SendMessageInput = {
  to: string;
  template: string;
  variables?: Record<string, string>;
  mediaUrl?: string;
};

export type SendMessageResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

export interface Connector {
  readonly provider: string;
  isConfigured(): boolean;
  testConnection(): Promise<{ ok: boolean; detail?: string }>;
  sync(opts: { since?: Date; orgId: string }): Promise<SyncResult>;
  // Optional capabilities
  sendMessage?(input: SendMessageInput): Promise<SendMessageResult>;
  fetchCampaigns?(externalAccountId: string): Promise<any[]>;
  fetchLeads?(externalAccountId: string, since?: Date): Promise<any[]>;
}