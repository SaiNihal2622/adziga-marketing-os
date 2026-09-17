import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Onboarding" };

const steps = [
  { key: "step1Business",   title: "Business information",     desc: "Tell us about the business we'll be marketing." },
  { key: "step2Objectives", title: "Marketing objectives",     desc: "What does success look like — lead generation, awareness, sales?" },
  { key: "step3Audience",   title: "Target audience",          desc: "Who are you trying to reach? Demographics, geography, behaviors." },
  { key: "step4Products",   title: "Products / services",      desc: "What are you offering and what makes it distinctive?" },
  { key: "step5Budget",     title: "Budget & spend",           desc: "Monthly marketing budget and split across channels." },
  { key: "step6Channels",   title: "Channels",                 desc: "Meta, Google, YouTube, WhatsApp, events, influencers — pick what applies." },
  { key: "step7BrandAssets",title: "Brand assets",             desc: "Logos, brand book, tone of voice, key messaging." },
  { key: "step8Access",     title: "Access & connectors",      desc: "Meta Business, Google Ads, WhatsApp Business, GA4, CRM." },
  { key: "step9Strategy",   title: "Strategy",                 desc: "Initial strategy outline based on the above." },
  { key: "step10Approval",  title: "Approval",                 desc: "Review, sign off, and finalize your onboarding." }
];

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-semibold">Adziga · Onboarding</div>
          <a href="/login" className="text-sm text-ink-600 hover:text-brand-600">Already have an account?</a>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-6 py-10">
        <OnboardingWizard steps={steps} />
      </div>
    </div>
  );
}