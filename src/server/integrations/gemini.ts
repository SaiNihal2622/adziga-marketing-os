// Adziga — Gemini (Google AI) connector
// Used for the AI Assistant + Intelligence layers when GEMINI_API_KEY is configured.

import { Connector, IntegrationConfig, SyncResult } from "./base";
import { logger } from "../logger";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiConnector implements Connector {
  readonly provider = "GEMINI";
  constructor(private config: IntegrationConfig) {}

  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  async testConnection(): Promise<{ ok: boolean; detail?: string }> {
    if (!this.isConfigured()) return { ok: false, detail: "GEMINI_API_KEY not set" };
    try {
      const r = await fetch(
        `${GEMINI_API}/models?key=${this.config.apiKey}`
      );
      if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
      const j: any = await r.json();
      const modelCount = j.models?.length ?? 0;
      return { ok: true, detail: `${modelCount} models available` };
    } catch (e: any) {
      return { ok: false, detail: e.message };
    }
  }

  async generateContent(prompt: string, opts: { systemInstruction?: string; model?: string }): Promise<string> {
    if (!this.isConfigured()) return "";
    const model = opts.model ?? "gemini-2.5-flash";
    try {
      const r = await fetch(
        `${GEMINI_API}/models/${model}:generateContent?key=${this.config.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: opts.systemInstruction ? { parts: [{ text: opts.systemInstruction }] } : undefined
          })
        }
      );
      const j: any = await r.json();
      return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } catch (e) {
      logger.error("gemini.generate_failed", { error: String(e) });
      return "";
    }
  }

  async sync(opts: { since?: Date; orgId: string }): Promise<SyncResult> {
    return { ok: true, itemsProcessed: 0, errors: [], durationMs: 0 };
  }
}