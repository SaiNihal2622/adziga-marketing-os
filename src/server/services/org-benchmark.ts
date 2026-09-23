// Adziga — OrgBenchmarkService (Sprint 17c)
// Per-org override of the global IndustryBenchmark table.
//
// Org admins tune their own ceilings — e.g. if their real-estate
// campaigns routinely tolerate a higher CPL than the all-industry
// median, they can override `cplMax` for industry=realestate /
// channel=META. The override is keyed by `${industry}:${channel}:${key}`
// and stored in Organization.metadata.benchmarkOverrides.
//
// "Effective" lookup = if an override exists for the org, return it;
// otherwise return the global IndustryBenchmark value.

import { prisma } from "@/lib/db";

const OVERRIDE_KEY = "benchmarkOverrides";

export type BenchmarkField = "cplMin" | "cplMedian" | "cplMax" | "ctrMedian" | "convMedian";

export type OrgBenchmarkOverride = {
  industry: string;
  channel: string;
  field: BenchmarkField;
  value: number;
  updatedAt: string;
  updatedBy?: string;
  note?: string;
};

export type EffectiveBenchmark = {
  industry: string;
  channel: string;
  field: BenchmarkField;
  value: number;
  overridden: boolean;
};

function safeJsonParse(s: string | null | undefined): Record<string, unknown> {
  if (!s) return {};
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function keyFor(o: { industry: string; channel: string; field: BenchmarkField }): string {
  return `${o.industry.toLowerCase()}::${o.channel.toLowerCase()}::${o.field}`;
}

function fromKey(k: string): { industry: string; channel: string; field: BenchmarkField } | null {
  const parts = k.split("::");
  if (parts.length !== 3) return null;
  const field = parts[2];
  if (!["cplMin", "cplMedian", "cplMax", "ctrMedian", "convMedian"].includes(field)) return null;
  return { industry: parts[0], channel: parts[1], field: field as BenchmarkField };
}

async function loadOverrides(orgId: string): Promise<Record<string, OrgBenchmarkOverride>> {
  const row = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { metadata: true }
  });
  const meta = safeJsonParse(row?.metadata);
  const raw = (meta[OVERRIDE_KEY] ?? {}) as Record<string, OrgBenchmarkOverride>;
  return raw;
}

async function saveOverrides(orgId: string, overrides: Record<string, OrgBenchmarkOverride>): Promise<void> {
  const row = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { metadata: true }
  });
  const meta = safeJsonParse(row?.metadata);
  await prisma.organization.update({
    where: { id: orgId },
    data: { metadata: JSON.stringify({ ...meta, [OVERRIDE_KEY]: overrides }) }
  });
}

export const OrgBenchmarkService = {
  /**
   * List all org overrides as a flat array.
   */
  async listOverrides(orgId: string): Promise<OrgBenchmarkOverride[]> {
    const map = await loadOverrides(orgId);
    return Object.values(map).sort((a, b) =>
      a.industry === b.industry
        ? a.channel === b.channel
          ? a.field.localeCompare(b.field)
          : a.channel.localeCompare(b.channel)
        : a.industry.localeCompare(b.industry)
    );
  },

  /**
   * Set or update a single override.
   */
  async setOverride(
    orgId: string,
    input: {
      industry: string;
      channel: string;
      field: BenchmarkField;
      value: number;
      updatedBy?: string;
      note?: string;
    }
  ): Promise<OrgBenchmarkOverride> {
    const map = await loadOverrides(orgId);
    const k = keyFor(input);
    const next: OrgBenchmarkOverride = {
      industry: input.industry,
      channel: input.channel,
      field: input.field,
      value: Math.max(0, Number(input.value)),
      updatedAt: new Date().toISOString(),
      updatedBy: input.updatedBy,
      note: input.note
    };
    map[k] = next;
    await saveOverrides(orgId, map);
    return next;
  },

  /**
   * Remove a single override.
   */
  async clearOverride(
    orgId: string,
    input: { industry: string; channel: string; field: BenchmarkField }
  ): Promise<boolean> {
    const map = await loadOverrides(orgId);
    const k = keyFor(input);
    if (!(k in map)) return false;
    delete map[k];
    await saveOverrides(orgId, map);
    return true;
  },

  /**
   * Effective benchmark for (industry, channel, field). Org override
   * wins; otherwise returns the global IndustryBenchmark value.
   * Returns null if no global row exists AND no org override exists.
   */
  async getEffectiveBenchmark(
    orgId: string,
    industry: string,
    channel: string,
    field: BenchmarkField
  ): Promise<EffectiveBenchmark | null> {
    const map = await loadOverrides(orgId);
    const k = keyFor({ industry, channel, field });
    if (k in map) {
      return { industry, channel, field, value: map[k].value, overridden: true };
    }

    // Look up global IndustryBenchmark — match on industry+objective "*"+channel
    const benchmark = await prisma.industryBenchmark.findFirst({
      where: { industry, channel }
    });
    if (!benchmark) return null;
    const globalValue = (benchmark as any)[field] as number | undefined;
    if (globalValue == null) return null;
    return { industry, channel, field, value: globalValue, overridden: false };
  },

  /**
   * Batch-resolve multiple lookups in one query — for the anomaly
   * detector that needs to load many ceilings at once.
   */
  async getEffectiveBenchmarkMap(
    orgId: string,
    keys: Array<{ industry: string; channel: string; field: BenchmarkField }>
  ): Promise<Map<string, EffectiveBenchmark>> {
    const map = await loadOverrides(orgId);
    const out = new Map<string, EffectiveBenchmark>();

    // First, override wins.
    const missing: typeof keys = [];
    for (const k of keys) {
      const composite = keyFor(k);
      if (composite in map) {
        const ov = map[composite];
        out.set(composite, {
          industry: k.industry,
          channel: k.channel,
          field: k.field,
          value: ov.value,
          overridden: true
        });
      } else {
        missing.push(k);
      }
    }

    if (missing.length === 0) return out;

    // Group missing by industry+channel to fetch each unique IndustryBenchmark
    // row once, then pluck the requested field.
    const uniques = new Map<string, { industry: string; channel: string; fields: BenchmarkField[] }>();
    for (const k of missing) {
      const uc = `${k.industry.toLowerCase()}::${k.channel.toLowerCase()}`;
      let slot = uniques.get(uc);
      if (!slot) {
        slot = { industry: k.industry, channel: k.channel, fields: [] };
        uniques.set(uc, slot);
      }
      slot.fields.push(k.field);
    }

    for (const slot of uniques.values()) {
      const benchmark = await prisma.industryBenchmark.findFirst({
        where: { industry: slot.industry, channel: slot.channel }
      });
      for (const f of slot.fields) {
        const composite = keyFor({ industry: slot.industry, channel: slot.channel, field: f });
        if (!benchmark) continue;
        const v = (benchmark as any)[f] as number | undefined;
        if (v == null) continue;
        out.set(composite, {
          industry: slot.industry,
          channel: slot.channel,
          field: f,
          value: v,
          overridden: false
        });
      }
    }

    return out;
  }
};

export { fromKey, keyFor };
