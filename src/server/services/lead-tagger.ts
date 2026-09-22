// Adziga — LeadTagger (Sprint 9a)
// Heuristic lead source auto-tagging. Derives lightweight tags from
// utm parameters, landing page, campaign platform, and email/phone
// patterns. The tags land on `Lead.tags` (comma-separated) so the UI
// can show them and ROI / segmentation queries can filter on them.
//
// Tag taxonomy:
//   industry:<slug>    — fintech | ecommerce | saas | healthcare | education |
//                        realestate | travel | food | beauty | fitness | other
//   region:tier1       — Mumbai, Delhi, Bangalore, etc.
//   region:tier2       — Pune, Hyderabad, Chennai, etc.
//   region:international — non-IN country code in phone or non-IN TLD
//   quality:hot        — utm content matches "trial" / "demo" / "buy" / "pricing"
//                        OR landing page contains /signup /demo /pricing
//   quality:warm       — utm has medium=cpc or paid-* or /contact /get-started
//   quality:cold       — utm source=organic OR medium=email OR /blog /
//   source:paid        — utm medium in cpc/ppc/paid-*
//   source:organic     — utm source = google/organic OR no utm
//   source:referral    — utm source in (referral, partner, affiliate)
//   source:email       — utm medium = email
//   device:mobile      — User-Agent hints (best-effort from landingPage alone)
//
// The tagger never overwrites manually-set tags: caller passes
// `{ append: true }` (default) and we union with existing tags.

export type TaggerInput = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  landingPage?: string | null;
  email?: string | null;
  phone?: string | null;
  campaignPlatform?: string | null; // META | GOOGLE | WHATSAPP | ...
  clientIndustry?: string | null;
  existingTags?: string | null;
};

const INDUSTRY_KEYWORDS: Array<[RegExp, string]> = [
  [/fintech|banking|loan|invest|wealth|crypto|trading/i, "fintech"],
  [/ecommerce|e-?commerce|shop|store|cart|retail/i, "ecommerce"],
  [/saas|software|b2b|workflow|crm|saas/i, "saas"],
  [/health|clinic|hospital|medic|pharma|telehealth/i, "healthcare"],
  [/education|edtech|learn|course|school|university|tutorial/i, "education"],
  [/real.?estate|property|housing|rental|builder/i, "realestate"],
  [/travel|tourism|flight|hotel|vacation/i, "travel"],
  [/food|restaurant|catering|grocery|delivery/i, "food"],
  [/beauty|cosmetic|skincare|salon|spa/i, "beauty"],
  [/fitness|gym|yoga|workout|wellness/i, "fitness"],
  [/auto|car|vehicle|transport|logistic/i, "auto"],
  [/media|entertainment|stream|gaming/i, "media"]
];

const TIER1_CITIES = ["mumbai", "delhi", "new delhi", "bangalore", "bengaluru", "hyderabad", "kolkata", "chennai", "ahmedabad", "pune"];
const TIER2_CITIES = ["jaipur", "lucknow", "kanpur", "nagpur", "indore", "thane", "bhopal", "visakhapatnam", "patna", "vadodara", "ghaziabad", "ludhiana", "agra", "nashik", "faridabad", "meerut", "rajkot", "varanasi", "srinagar", "aurangabad", "dhanbad", "amritsar", "navi mumbai", "allahabad", "ranchi", "haora", "coimbatore", "jabalpur", "guwahati", "chandigarh", "solapur", "hubli", "mysore", "tiruchirappalli", "bareilly", "aligarh", "tiruppur", "gurgaon", "gurugram", "moradabad", "jalandhar", "bhubaneswar", "kochi"];

const COUNTRY_CODES_NON_IN = /^(\+|00)(?!(91))/; // any intl prefix that isn't +91 / 0091

export const LeadTagger = {
  /**
   * Compute tags for a lead. Pure function — does not write to DB.
   * Caller decides whether to append or replace.
   */
  derive(input: TaggerInput): string[] {
    const tags = new Set<string>();

    // 1. Industry — first match wins, priority to landingPage + utm.
    const probe = [input.landingPage, input.utmSource, input.utmCampaign, input.utmContent, input.clientIndustry]
      .filter(Boolean)
      .join(" ");
    for (const [re, slug] of INDUSTRY_KEYWORDS) {
      if (re.test(probe)) {
        tags.add(`industry:${slug}`);
        break;
      }
    }
    if (input.clientIndustry) {
      tags.add(`industry:${slugify(input.clientIndustry)}`);
    }

    // 2. Region — from city (if extracted elsewhere) or phone prefix.
    // The Lead model doesn't store city in raw form for this service, but
    // landingPage or utmContent often includes a city slug.
    const cityProbe = (input.landingPage ?? "").toLowerCase();
    for (const c of TIER1_CITIES) {
      if (cityProbe.includes(c)) {
        tags.add("region:tier1");
        break;
      }
    }
    if (!tags.has("region:tier1")) {
      for (const c of TIER2_CITIES) {
        if (cityProbe.includes(c)) {
          tags.add("region:tier2");
          break;
        }
      }
    }
    if (input.phone && COUNTRY_CODES_NON_IN.test(input.phone.trim())) {
      tags.add("region:international");
    }

    // 3. Source — from utm.
    const src = (input.utmSource ?? "").toLowerCase();
    const med = (input.utmMedium ?? "").toLowerCase();
    if (med === "cpc" || med === "ppc" || med.startsWith("paid")) {
      tags.add("source:paid");
    } else if (med === "email") {
      tags.add("source:email");
    } else if (src === "google" && !med) {
      tags.add("source:organic");
    } else if (src === "" || !input.utmSource) {
      tags.add("source:organic");
    } else if (["referral", "partner", "affiliate"].includes(src)) {
      tags.add("source:referral");
    }

    // 4. Quality — from utm content + landing page.
    const intent = (input.utmContent ?? "").toLowerCase();
    const lp = (input.landingPage ?? "").toLowerCase();
    if (
      /trial|demo|buy|pricing|quote|cart|checkout|signup|sign-up|register/.test(intent) ||
      /\/(signup|sign-up|register|demo|pricing|buy|checkout|cart)\b/.test(lp)
    ) {
      tags.add("quality:hot");
    } else if (
      med === "cpc" ||
      med === "ppc" ||
      med.startsWith("paid") ||
      /\/(contact|get-started|talk-to|book-a-demo)\b/.test(lp)
    ) {
      tags.add("quality:warm");
    } else if (
      src === "organic" ||
      med === "email" ||
      /\/blog\/|\/resources\/|\/learn\//.test(lp)
    ) {
      tags.add("quality:cold");
    }

    // 5. Platform echo — useful for cross-channel segmentation.
    if (input.campaignPlatform) {
      tags.add(`platform:${input.campaignPlatform.toLowerCase()}`);
    }

    return Array.from(tags).sort();
  },

  /**
   * Derive tags and union with existing. Returns a comma-separated string
   * ready for the Lead.tags field.
   */
  merge(input: TaggerInput): string {
    const derived = this.derive(input);
    const existing = (input.existingTags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    const set = new Set([...existing, ...derived]);
    return Array.from(set).sort().join(",");
  }
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "other";
}
