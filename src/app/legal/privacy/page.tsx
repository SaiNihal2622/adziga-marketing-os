import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Adziga",
  description: "Adziga privacy policy - how we collect, store, and process your data."
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-ink-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-ink-500 hover:text-brand-600">← Back to Adziga</Link>
        <h1 className="text-4xl font-display font-semibold text-ink-900 mt-6 mb-2">Privacy Policy</h1>
        <p className="text-ink-500 text-sm mb-12">Last updated: 21 September 2026</p>

        <Section title="1. Scope">
          <p>This policy describes how Adziga Technologies Private Limited ("Adziga", "we") collects, uses, stores, and shares personal information when you use our marketing operating system at adziga.in (the "Service"). It applies to all visitors, account holders, and end-users whose data flows through the Service (including your own customers and leads).</p>
        </Section>

        <Section title="2. Information We Collect">
          <p><strong>Account data:</strong> name, email, phone, password (bcrypt-hashed), organization details, GSTIN (if provided), billing address.</p>
          <p><strong>Service data:</strong> campaigns, creatives, leads, customer records, integration credentials (encrypted at rest), reports, automations, AI interactions.</p>
          <p><strong>Technical data:</strong> IP address, user agent, request timestamps, error logs (retained 30 days for security).</p>
        </Section>

        <Section title="3. Lawful Basis">
          <p>We process personal data under one or more of the following lawful bases under the Digital Personal Data Protection Act, 2023 ("DPDP Act"): (a) consent; (b) performance of a contract with you; (c) compliance with a legal obligation; (d) legitimate uses as defined under Section 7 of the DPDP Act.</p>
        </Section>

        <Section title="4. How We Use Data">
          <p>We use data to: (a) provide and improve the Service; (b) authenticate users and prevent fraud; (c) send transactional emails (magic-link login, billing, security alerts); (d) train per-organization AI models on your content patterns and campaign outcomes (your data never trains global models); (e) comply with tax and audit obligations.</p>
          <p>We do not sell personal data. We do not use your data to train third-party AI models.</p>
        </Section>

        <Section title="5. Cookies and Local Storage">
          <p>We use strictly necessary session cookies (NextAuth / auth.js) to keep you signed in. We do not use third-party advertising or analytics cookies. We do not use cross-site tracking.</p>
        </Section>

        <Section title="6. Third-Party Processors">
          <p>We use these sub-processors to deliver the Service:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Neon (Postgres hosting) — Frankfurt region; data at rest encrypted.</li>
            <li>Vercel (hosting + edge functions) — global CDN; data in transit TLS 1.2+.</li>
            <li>Razorpay (payments) — PCI-DSS compliant; we never store card numbers.</li>
            <li>Resend / SMTP (transactional email) — only when you configure them.</li>
            <li>Google Gemini (optional AI) — only when you provide an API key.</li>
          </ul>
        </Section>

        <Section title="7. Data Retention">
          <p>Account data: lifetime of account + 90 days post-deletion. Lead/campaign data: retained until you delete it or close the org. Billing records: 8 years (Income Tax Act, 1961). Audit logs: 7 years (SOX-equivalent). Backups: 30-day rolling.</p>
        </Section>

        <Section title="8. Your Rights">
          <p>Under the DPDP Act and applicable Indian law, you have the right to: (a) access a summary of personal data we hold about you; (b) correct inaccurate data; (c) request deletion (subject to retention obligations above); (d) withdraw consent; (e) nominate another individual to exercise your rights in case of death or incapacity. Email privacy@adziga.in to exercise any right.</p>
        </Section>

        <Section title="9. Cross-Border Transfers">
          <p>Primary data is stored in India (Neon AWS Mumbai). Some sub-processors (Vercel, Google Gemini if used) may process data outside India under their standard contractual clauses. We will notify you before any new sub-processor is added.</p>
        </Section>

        <Section title="10. Security">
          <p>We use TLS 1.2+ in transit, AES-256 at rest, bcrypt-12 for password hashing, HMAC SHA-256 for webhook signatures, optional TOTP multi-factor authentication, per-org data isolation enforced at the application layer, and structured audit logging for sensitive actions. Despite our efforts, no system is 100% secure - if you discover a vulnerability, please email security@adziga.in.</p>
        </Section>

        <Section title="11. Children">
          <p>The Service is not directed at children under 18. We do not knowingly collect personal data from children. If you believe a child has provided data, contact privacy@adziga.in and we will delete it.</p>
        </Section>

        <Section title="12. Grievance Officer">
          <p>Under the DPDP Act and IT Rules 2021, our Grievance Officer is:<br /><strong>Name:</strong> [Designated Officer]<br /><strong>Email:</strong> grievance@adziga.in<br />We respond to grievances within 15 days.</p>
        </Section>

        <Section title="13. Changes">
          <p>Material changes will be announced by email at least 14 days before they take effect. Continued use after the effective date constitutes acceptance.</p>
        </Section>

        <Section title="14. Contact">
          <p>Adziga Technologies Private Limited<br />Bengaluru, Karnataka, India<br />privacy@adziga.in</p>
          <p>See also our <Link href="/legal/terms" className="text-brand-600 hover:underline">Terms of Service</Link> and <Link href="/legal/refund" className="text-brand-600 hover:underline">Refund Policy</Link>.</p>
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
