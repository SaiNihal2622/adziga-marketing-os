import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy - Adziga",
  description: "Adziga subscription cancellation and refund terms."
};

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-ink-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-ink-500 hover:text-brand-600">← Back to Adziga</Link>
        <h1 className="text-4xl font-display font-semibold text-ink-900 mt-6 mb-2">Refund & Cancellation Policy</h1>
        <p className="text-ink-500 text-sm mb-12">Last updated: 21 September 2026</p>

        <Section title="1. Cancellation">
          <p>You may cancel your Adziga subscription at any time from <Link href="/app/admin/billing" className="text-brand-600 hover:underline">Billing</Link> or by emailing billing@adziga.in. Cancellations take effect at the end of the current billing period — the Service remains available until then. No further invoices will be issued after cancellation takes effect.</p>
        </Section>

        <Section title="2. Free Tier">
          <p>The Free tier is provided at no cost and may be downgraded or discontinued at any time. Downgrading from a paid plan to the Free tier does not entitle you to a refund of the current period.</p>
        </Section>

        <Section title="3. Refund Window">
          <p>For Pro and Ziga Plus subscriptions, you may request a full refund within <strong>7 days</strong> of the original charge if the Service materially fails to meet the documented feature set for your tier. After 7 days, the current billing period is non-refundable.</p>
          <p>Refunds are not provided for:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Partial months of usage after the 7-day window.</li>
            <li>Charges arising from usage-based fees (over-plan clients, add-ons).</li>
            <li>Service unavailability caused by factors outside our reasonable control (your internet, your hosting provider, force majeure).</li>
          </ul>
        </Section>

        <Section title="4. How to Request a Refund">
          <p>Email billing@adziga.in from your account email within 7 days of the charge. Include your organization name and the invoice number. Approved refunds are processed within 7 business days via the original payment method (Razorpay).</p>
        </Section>

        <Section title="5. Disputes and Consumer Protection">
          <p>If you are dissatisfied with the resolution, you may escalate the dispute through the Consumer Protection (E-Commerce) Rules, 2020 framework or the National Consumer Helpline (1915). We will cooperate with such processes in good faith.</p>
        </Section>

        <Section title="6. Chargebacks">
          <p>Before initiating a chargeback with your card issuer, please contact us first — most issues are resolved within 24 hours. Unwarranted chargebacks may result in suspension of your account.</p>
        </Section>

        <Section title="7. Tax Adjustments">
          <p>Refund amounts are net of any GST already collected and remitted, in accordance with GST law. We will issue a credit note against the original invoice for the refunded portion.</p>
        </Section>

        <Section title="8. Contact">
          <p>Adziga Technologies Private Limited<br />Bengaluru, Karnataka, India<br />billing@adziga.in</p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-display font-semibold text-ink-900 mb-3">{title}</h2>
      <div className="prose prose-sm max-w-none text-ink-700 leading-relaxed space-y-3 [&_p]:mb-3 [&_ul]:my-3">{children}</div>
    </section>
  );
}
