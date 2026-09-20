import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - Adziga",
  description: "Adziga Marketing Operating System terms of service."
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-ink-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-ink-500 hover:text-brand-600">← Back to Adziga</Link>
        <h1 className="text-4xl font-display font-semibold text-ink-900 mt-6 mb-2">Terms of Service</h1>
        <p className="text-ink-500 text-sm mb-12">Last updated: 21 September 2026</p>

        <Section title="1. Acceptance">
          <p>By creating an Adziga account, signing in, or using any Adziga service, you agree to these Terms of Service and our Privacy Policy. If you are entering into this agreement on behalf of a company, you represent that you have authority to bind that company, and references to "you" mean that company.</p>
        </Section>

        <Section title="2. The Service">
          <p>Adziga is a marketing operating system for agencies and in-house marketing teams in India. The Service includes campaign management, lead routing, creative workflows, marketing intelligence, and billing automation. Specific features are gated to subscription tiers (Free, Pro, Ziga Plus) as described on the pricing page.</p>
        </Section>

        <Section title="3. Accounts and Eligibility">
          <p>You must be at least 18 years old and legally able to enter contracts in India. You are responsible for activity on your account and for keeping credentials secure. Multi-factor authentication is strongly recommended and may be required for certain roles.</p>
        </Section>

        <Section title="4. Subscriptions, GST and Refunds">
          <p>Paid subscriptions (Pro at INR 4,900/month, Ziga Plus at INR 24,900/month) are billed in advance via Razorpay. Invoices are issued with sequential GST-compliant numbering per financial year (April-March). Subscription auto-renews until cancelled.</p>
          <p>You may cancel at any time; the cancellation takes effect at the end of the current billing period, and the Service remains available until then. We do not offer refunds for partial months except where required by the Consumer Protection (E-Commerce) Rules, 2020 or other applicable Indian law.</p>
          <p>GST-registered customers may enter their GSTIN on the billing page; we will reflect it on subsequent invoices.</p>
        </Section>

        <Section title="5. Acceptable Use">
          <p>You agree not to: (a) violate any Indian law including the Information Technology Act, 2000 and rules made thereunder; (b) send unsolicited commercial communications in violation of the TRAI TCCCPR-2018 regulations; (c) upload content that infringes intellectual property rights; (d) attempt to reverse-engineer the Service; or (e) interfere with security features.</p>
        </Section>

        <Section title="6. AI Assistance - Important">
          <p>The Adziga AI Assistant is an explainer and summarizer, not an autonomous agent. It never publishes campaigns, sends messages to leads, or modifies strategy without your explicit approval. AI-generated recommendations are suggestions and may be inaccurate; you remain responsible for all decisions and approvals.</p>
        </Section>

        <Section title="7. Data and Privacy">
          <p>Your use of the Service is also governed by our <Link href="/legal/privacy" className="text-brand-600 hover:underline">Privacy Policy</Link>. We process personal data only on your documented instructions and per our Data Processing Addendum (available on request for Ziga Plus customers).</p>
        </Section>

        <Section title="8. Intellectual Property">
          <p>We retain all rights to the Service, including software, designs, and trademarks. You retain all rights to your data, client data, campaigns, creatives, and content uploaded to the Service. You grant us a limited licence to use that data solely to provide the Service.</p>
        </Section>

        <Section title="9. Service Availability">
          <p>We target 99.9% monthly availability for paid tiers. Scheduled maintenance is announced at least 48 hours in advance. Service credits for SLA misses are described in our SLA document (available on request).</p>
        </Section>

        <Section title="10. Disclaimers and Liability">
          <p>The Service is provided "as is" without warranties of any kind except as required by Indian law. To the maximum extent permitted by law, our aggregate liability is limited to the fees paid in the twelve months preceding the claim. We are not liable for indirect, consequential, or punitive damages.</p>
        </Section>

        <Section title="11. Governing Law and Disputes">
          <p>These Terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts in Bengaluru, Karnataka. We prefer to resolve disputes amicably - please contact legal@adziga.in first.</p>
        </Section>

        <Section title="12. Contact">
          <p>Adziga Technologies Private Limited<br />Bengaluru, Karnataka, India<br />legal@adziga.in</p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-display font-semibold text-ink-900 mb-3">{title}</h2>
      <div className="prose prose-sm max-w-none text-ink-700 leading-relaxed space-y-3 [&_p]:mb-3">{children}</div>
    </section>
  );
}
