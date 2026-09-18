// Adziga — Integration registry
// Reads env-based config and provides connector instances.

import { Connector, IntegrationConfig } from "./base";
import { MetaConnector } from "./meta";
import { GoogleConnector } from "./google";
import { WhatsAppConnector } from "./whatsapp";
import { GeminiConnector } from "./gemini";

function readConfig(): Record<string, IntegrationConfig> {
  return {
    META: {
      apiKey: process.env.META_ACCESS_TOKEN,
      accountId: process.env.META_AD_ACCOUNT_ID,
      apiSecret: process.env.META_APP_SECRET,
      webhookUrl: process.env.META_WEBHOOK_URL
    },
    GOOGLE: {
      apiKey: process.env.GOOGLE_ADS_ACCESS_TOKEN,
      accountId: process.env.GOOGLE_ADS_CUSTOMER_ID,
      apiSecret: process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    },
    WHATSAPP: {
      apiKey: process.env.WHATSAPP_API_TOKEN,
      accountId: process.env.WHATSAPP_PHONE_NUMBER_ID
    },
    GEMINI: {
      apiKey: process.env.GEMINI_API_KEY
    }
  };
}

export function getConnector(provider: string): Connector {
  const configs = readConfig();
  const cfg = configs[provider];
  if (!cfg) throw new Error(`Unknown provider: ${provider}`);

  switch (provider) {
    case "META":
      return new MetaConnector(cfg);
    case "GOOGLE":
      return new GoogleConnector(cfg);
    case "WHATSAPP":
      return new WhatsAppConnector(cfg);
    case "GEMINI":
      return new GeminiConnector(cfg);
    default:
      throw new Error(`Provider ${provider} not yet implemented`);
  }
}

export function getAllConnectors(): Record<string, Connector> {
  return {
    META: getConnector("META"),
    GOOGLE: getConnector("GOOGLE"),
    WHATSAPP: getConnector("WHATSAPP"),
    GEMINI: getConnector("GEMINI")
  };
}