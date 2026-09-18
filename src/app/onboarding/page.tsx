"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ──────────────────────────────────────────────────────────────────────
// Types + step metadata. The /api/onboarding route expects optional
// step1Business…step5Budget string fields; we JSON-stringify each step's
// structured payload into the matching key, preserving the API contract.
// ──────────────────────────────────────────────────────────────────────

type StepNumber = 1 | 2 | 3 | 4 | 5;

interface Profile {
  workspaceName: string;
  industry: string;
  teamSize: string;
  primaryGoal: string;
}

const STEPS: Array<{
  num: StepNumber;
  label: string;
  apiKey: "step1Business" | "step2Objectives" | "step3Audience" | "step4Products" | "step5Budget";
}> = [
  { num: 1, label: "Welcome",        apiKey: "step1Business" },
  { num: 2, label: "Profile",        apiKey: "step2Objectives" },
  { num: 3, label: "Connect",        apiKey: "step3Audience" },
  { num: 4, label: "First campaign", apiKey: "step4Products" },
  { num: 5, label: "Done",           apiKey: "step5Budget" },
];

const INDUSTRIES = [
  { value: "real-estate",         label: "Real Estate" },
  { value: "financial-services",  label: "Financial Services" },
  { value: "education",           label: "Education" },
  { value: "e-commerce",          label: "E-commerce" },
  { value: "saas",                label: "SaaS" },
  { value: "healthcare",          label: "Healthcare" },
  { value: "other",               label: "Other" }
];

const TEAM_SIZES = [
  { value: "solo",   label: "Solo",   desc: "Just me",          icon: "user"   },
  { value: "small",  label: "Small",  desc: "2 – 10 people",    icon: "users"  },
  { value: "medium", label: "Medium", desc: "11 – 50 people",   icon: "team"   },
  { value: "large",  label: "Large",  desc: "50+ people",       icon: "org"    }
];

const PRIMARY_GOALS = [
  { value: "leads",       label: "Generate leads",  desc: "Fill the funnel",  icon: "target" },
  { value: "sales",       label: "Drive sales",     desc: "Convert to revenue", icon: "cart"   },
  { value: "brand",       label: "Build brand",     desc: "Grow awareness",   icon: "sparkle"},
  { value: "experiments", label: "Run experiments", desc: "Test and learn",   icon: "beaker" }
];

const CHANNELS = [
  { id: "meta",     name: "Meta",               desc: "Facebook + Instagram Ads",         brand: "#1877F2" },
  { id: "google",   name: "Google Ads",         desc: "Search + Display + YouTube",       brand: "#4285F4" },
  { id: "whatsapp", name: "WhatsApp Business",  desc: "Click-to-chat + Catalog ads",      brand: "#25D366" },
  { id: "razorpay", name: "Razorpay",           desc: "Billing & subscription management", brand: "#3395FF" }
];

const TEMPLATES = [
  {
    id: "leadgen",
    name: "Lead generation",
    channel: "META",
    desc: "Run lead-gen ads on Facebook + Instagram. Best for B2C, real estate, education.",
    icon: "target"
  },
  {
    id: "brand",
    name: "Brand awareness",
    channel: "Multi-channel",
    desc: "Reach your audience across Meta, Google, and YouTube with one unified brand message.",
    icon: "sparkle"
  },
  {
    id: "retargeting",
    name: "Retargeting",
    channel: "GOOGLE",
    desc: "Re-engage visitors who didn't convert with high-intent Google Display + Search ads.",
    icon: "bolt"
  }
];

// ──────────────────────────────────────────────────────────────────────
// Network helper. Best-effort POST — wizard always completes even when
// the network is unavailable; failures only log a warning.
// ──────────────────────────────────────────────────────────────────────

function postStep(apiKey: string, payload: unknown): void {
  try {
    void fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [apiKey]: JSON.stringify(payload) })
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("onboarding.post failed", e);
  }
}

// ──────────────────────────────────────────────────────────────────────
// Iconography — single shared SVG primitive + a path dictionary.
// Keeps the JSX tiny without pulling in an icon package.
// ──────────────────────────────────────────────────────────────────────

const ICON_PATHS: Record<string, string> = {
  check:       "M5 13l4 4L19 7",
  chevronDown: "M6 9l6 6 6-6",
  chevronLeft: "M15 18l-6-6 6-6",
  arrowRight:  "M5 12h14M12 5l7 7-7 7",
  user:        "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  users:       "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 11-8 0 4 4 0 018 0zM21 7a4 4 0 11-8 0 4 4 0 018 0z",
  team:        "M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm10 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  org:         "M3 21V8l9-5 9 5v13M9 21V12h6v9",
  target:      "M12 21a9 9 0 100-18 9 9 0 000 18zM12 17a5 5 0 100-10 5 5 0 000 10zM12 13a1 1 0 100-2 1 1 0 000 2z",
  cart:        "M3 3h2l.4 2M7 13h10l4-8M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 0a2 2 0 100 4 2 2 0 000-4z",
  sparkle:     "M12 3l2 6 6 1-4.5 4 1.5 6-5-3-5 3 1.5-6L4 10l6-1 2-6z",
  beaker:      "M9 3h6v4l5 11a2 2 0 01-2 3H6a2 2 0 01-2-3l5-11V3zM8 13h8",
  bolt:        "M13 2L3 14h7l-1 8 10-12h-7l1-8z"
};

function Icon({
  name,
  className = "w-4 h-4",
  strokeWidth = 1.75
}: {
  name: keyof typeof ICON_PATHS;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

// Compact channel brand mark (simple geometric stand-ins — accurate enough)
function ChannelMark({ id }: { id: string }) {
  const c = CHANNELS.find((x) => x.id === id);
  const brand = c?.brand ?? "#525d72";
  return (
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-semibold shrink-0"
      style={{ background: brand }}
    >
      {id === "meta"     && "M"}
      {id === "google"   && "G"}
      {id === "whatsapp" && "W"}
      {id === "razorpay" && "R"}
    </div>
  );
}

// ─── Stepper — sticky, 5 circles + connectors ───

function Stepper({ current }: { current: StepNumber }) {
  return (
    <div className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-ink-100">
      <div className="max-w-3xl mx-auto py-4 px-4">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const isCurrent = current === s.num;
            const isComplete = current > s.num;
            const circleCls = isCurrent
              ? "bg-brand-600 text-white w-9 h-9 text-sm shadow-md"
              : isComplete
                ? "bg-emerald-500 text-white w-7 h-7 text-xs"
                : "bg-white border border-ink-200 text-ink-400 w-7 h-7 text-xs";
            const labelCls = isCurrent
              ? "text-brand-700"
              : isComplete
                ? "text-emerald-700"
                : "text-ink-400";
            return (
              <div key={s.num} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div
                    className={`flex items-center justify-center rounded-full font-semibold transition-all duration-200 tabular-nums ${circleCls}`}
                  >
                    {isComplete ? <Icon name="check" className="w-3.5 h-3.5" strokeWidth={2.5} /> : s.num}
                  </div>
                  <span className={`text-[10px] font-medium uppercase tracking-wider whitespace-nowrap ${labelCls}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 mx-2 -mt-5">
                    <div className="h-px bg-ink-200 relative overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out ${
                          current > s.num ? "bg-emerald-500 w-full" : "bg-transparent w-0"
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Welcome ───

function StepWelcome({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="flex justify-center">
      <div className="card-v0 bg-bento glow-brand w-full max-w-[480px] p-10 text-center">
        <div className="flex justify-center mb-5">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md"
            style={{ background: "linear-gradient(135deg, #243ff0 0%, #d946ef 100%)" }}
          >
            A
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome to Adziga</h1>
        <p className="text-ink-600 mb-7 leading-relaxed">
          Let&apos;s get your workspace ready in 5 quick steps.<br />
          Takes about 3 minutes.
        </p>
        <ul className="text-left space-y-3 mb-8">
          {["Set up your profile", "Connect your channels", "Run your first campaign"].map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-ink-800">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                <Icon name="check" className="w-3 h-3" strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
        <button onClick={onNext} className="btn btn-primary w-full py-2.5 text-base focus-ring">
          Let&apos;s go
          <Icon name="arrowRight" className="w-4 h-4" />
        </button>
        <button
          onClick={onSkip}
          className="mt-4 text-xs text-ink-500 hover:text-ink-700 transition-colors"
        >
          Skip — explore the dashboard
        </button>
      </div>
    </div>
  );
}

// ─── Reusable radio card (Step 2 team-size + primary-goal sections) ───

function RadioCard({
  selected,
  onClick,
  label,
  desc,
  icon
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  desc: string;
  icon: keyof typeof ICON_PATHS;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card-v0 flex items-center gap-3 p-3 text-left transition-all focus-ring ${
        selected ? "border-brand-500 ring-1 ring-brand-500/30 bg-brand-50/40" : ""
      }`}
    >
      <span
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
          selected ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600"
        }`}
      >
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-ink-900">{label}</span>
        <span className="block text-xs text-ink-500 tabular-nums">{desc}</span>
      </span>
      <span
        className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${
          selected ? "border-brand-600 bg-brand-600" : "border-ink-300 bg-white"
        }`}
      >
        {selected && <span className="block w-1.5 h-1.5 rounded-full bg-white mx-auto mt-[3px]" />}
      </span>
    </button>
  );
}

// ─── Step 2: Profile ───

function StepProfile({
  profile,
  setProfile,
  onContinue,
  onBack
}: {
  profile: Profile;
  setProfile: (p: Profile) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const valid =
    profile.workspaceName.trim().length >= 2 &&
    !!profile.industry &&
    !!profile.teamSize &&
    !!profile.primaryGoal;

  return (
    <div className="max-w-[420px] mx-auto">
      <button
        onClick={onBack}
        className="text-sm text-ink-500 hover:text-ink-800 mb-4 inline-flex items-center gap-1 focus-ring rounded"
      >
        <Icon name="chevronLeft" className="w-3.5 h-3.5" />
        Back
      </button>
      <h2 className="text-2xl font-bold tracking-tight mb-1">Tell us about your workspace</h2>
      <p className="text-sm text-ink-500 mb-6">
        This shapes the templates, channels, and benchmarks we suggest for your team.
      </p>

      <div className="space-y-4">
        <div>
          <label className="label">Workspace name</label>
          <input
            type="text"
            value={profile.workspaceName}
            onChange={(e) => setProfile({ ...profile, workspaceName: e.target.value })}
            placeholder="e.g. Acme Realty"
            className="input focus-ring"
            autoComplete="organization"
          />
        </div>

        <div>
          <label className="label">Industry</label>
          <div className="relative">
            <select
              value={profile.industry}
              onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
              className="input focus-ring appearance-none pr-10"
            >
              <option value="">Select an industry…</option>
              {INDUSTRIES.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
            <Icon
              name="chevronDown"
              className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
            />
          </div>
        </div>

        <div>
          <label className="label">Team size</label>
          <div className="grid grid-cols-2 gap-2">
            {TEAM_SIZES.map((t) => (
              <RadioCard
                key={t.value}
                selected={profile.teamSize === t.value}
                onClick={() => setProfile({ ...profile, teamSize: t.value })}
                label={t.label}
                desc={t.desc}
                icon={t.icon as keyof typeof ICON_PATHS}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="label">Primary goal</label>
          <div className="grid grid-cols-2 gap-2">
            {PRIMARY_GOALS.map((g) => (
              <RadioCard
                key={g.value}
                selected={profile.primaryGoal === g.value}
                onClick={() => setProfile({ ...profile, primaryGoal: g.value })}
                label={g.label}
                desc={g.desc}
                icon={g.icon as keyof typeof ICON_PATHS}
              />
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onContinue}
        disabled={!valid}
        className="btn btn-primary w-full mt-6 py-2.5 focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue
        <Icon name="arrowRight" className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Step 3: Connect channels ───

function StepConnect({
  connected,
  toggle,
  onContinue,
  onSkip
}: {
  connected: Set<string>;
  toggle: (id: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const count = connected.size;
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight mb-1">Connect your ad accounts</h2>
      <p className="text-sm text-ink-500 mb-6">
        We&apos;ll pull in live data from each platform. Skip and connect later — no pressure.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
        {CHANNELS.map((c) => {
          const isOn = connected.has(c.id);
          return (
            <div key={c.id} className="card-v0 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-4">
                <ChannelMark id={c.id} />
                <div className="min-w-0">
                  <div className="font-medium text-sm text-ink-900">{c.name}</div>
                  <div className="text-xs text-ink-500 mt-0.5">{c.desc}</div>
                </div>
              </div>
              {isOn ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                  <Icon name="check" className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Connected
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  className="btn btn-outline text-xs py-1 px-3 focus-ring w-full"
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-ink-500 mt-5 tabular-nums">
        {count} of {CHANNELS.length} connected
      </p>

      <div className="flex flex-col items-center mt-6 gap-2">
        <button onClick={onContinue} className="btn btn-primary px-8 py-2.5 focus-ring">
          Continue
          <Icon name="arrowRight" className="w-4 h-4" />
        </button>
        <button
          onClick={onSkip}
          className="text-xs text-ink-500 hover:text-ink-700 transition-colors"
        >
          Skip — connect later
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: First campaign ───

function StepCampaign({
  selected,
  setSelected,
  onRun,
  onSkip
}: {
  selected: string | null;
  setSelected: (id: string) => void;
  onRun: () => void;
  onSkip: () => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight mb-1">Spin up your first campaign</h2>
      <p className="text-sm text-ink-500 mb-6">
        Pick a template — you can customize everything later from the campaign builder.
      </p>

      <div className="space-y-3 max-w-2xl mx-auto">
        {TEMPLATES.map((t) => {
          const isOn = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t.id)}
              className={`card-v0 w-full flex items-start gap-4 p-4 text-left transition-all focus-ring ${
                isOn ? "border-brand-500 ring-1 ring-brand-500/30" : ""
              }`}
            >
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-50 text-brand-700 shrink-0">
                <Icon name={t.icon as keyof typeof ICON_PATHS} className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-ink-900">{t.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded tabular-nums">
                    {t.channel}
                  </span>
                </div>
                <p className="text-xs text-ink-500 mt-1 leading-relaxed">{t.desc}</p>
              </div>
              <span
                className={`w-4 h-4 rounded-full border-2 shrink-0 mt-1 transition-all ${
                  isOn ? "border-brand-600 bg-brand-600" : "border-ink-300 bg-white"
                }`}
              >
                {isOn && <span className="block w-1.5 h-1.5 rounded-full bg-white mx-auto mt-[3px]" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center mt-8 gap-2">
        <button
          onClick={onRun}
          disabled={!selected}
          className="btn btn-primary px-8 py-2.5 focus-ring glow-brand disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Run template
          <Icon name="arrowRight" className="w-4 h-4" />
        </button>
        <button
          onClick={onSkip}
          className="text-xs text-ink-500 hover:text-ink-700 transition-colors"
        >
          Skip — I&apos;ll do it myself
        </button>
      </div>
    </div>
  );
}

// ─── Step 5: Done ───

function StepDone({
  onDashboard,
  onTour,
  onInvite
}: {
  onDashboard: () => void;
  onTour: () => void;
  onInvite: () => void;
}) {
  return (
    <div className="flex justify-center">
      <div className="card-v0 w-full max-w-[520px] p-10 text-center bg-bento">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full bg-brand-500/25 animate-live"
              aria-hidden="true"
            />
            <div
              className="relative w-20 h-20 rounded-full flex items-center justify-center text-white glow-brand"
              style={{ background: "linear-gradient(135deg, #243ff0 0%, #d946ef 100%)" }}
            >
              <Icon name="check" className="w-10 h-10" strokeWidth={2.5} />
            </div>
          </div>
        </div>
        <h2 className="text-3xl font-bold tracking-tight mb-2">You&apos;re all set!</h2>
        <p className="text-ink-600 mb-8 leading-relaxed">
          Your Adziga workspace is ready.<br />
          Time to make marketing a system.
        </p>
        <button
          onClick={onDashboard}
          className="btn btn-primary w-full py-2.5 text-base glow-brand focus-ring"
        >
          Go to dashboard
          <Icon name="arrowRight" className="w-4 h-4" />
        </button>
        <div className="flex items-center justify-center gap-4 mt-5 text-xs text-ink-500">
          <button
            onClick={onTour}
            className="hover:text-ink-800 transition-colors focus-ring rounded"
          >
            Take a quick tour
          </button>
          <span className="text-ink-200">·</span>
          <button
            onClick={onInvite}
            className="hover:text-ink-800 transition-colors focus-ring rounded"
          >
            Invite teammates
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page — orchestrates state + step transitions ───

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [profile, setProfile] = useState<Profile>({
    workspaceName: "Adziga Workspace",
    industry: "",
    teamSize: "",
    primaryGoal: ""
  });
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState<string | null>(null);
  const completedOnce = useRef(false);

  // Set page title. Page is a client component so the metadata export
  // isn't available; document.title is the cleanest workaround.
  useEffect(() => {
    document.title = "Onboarding · Adziga";
  }, []);

  // Send the final completion payload once when the user first lands
  // on step 5. Ref guard prevents double-posting on re-renders.
  useEffect(() => {
    if (currentStep === 5 && !completedOnce.current) {
      completedOnce.current = true;
      postStep("step5Budget", {
        status: "complete",
        profile,
        connectedChannels: Array.from(connected),
        template,
        completedAt: new Date().toISOString()
      });
    }
  }, [currentStep, profile, connected, template]);

  const goNext = (apiPayload: unknown) => {
    const stepMeta = STEPS.find((s) => s.num === currentStep)!;
    postStep(stepMeta.apiKey, apiPayload);
    if (currentStep < 5) {
      setCurrentStep((currentStep + 1) as StepNumber);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goBack = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as StepNumber);
  };

  const skipToDashboard = () => router.push("/app/overview");

  return (
    <div className="min-h-screen bg-ink-50">
      <Stepper current={currentStep} />

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Re-mount on step change so the slide-up + fade-in replay */}
        <div key={currentStep} className="slide-up fade-in">
          {currentStep === 1 && (
            <StepWelcome
              onNext={() => goNext({ status: "seen" })}
              onSkip={skipToDashboard}
            />
          )}
          {currentStep === 2 && (
            <StepProfile
              profile={profile}
              setProfile={setProfile}
              onContinue={() => goNext({ status: "complete", ...profile })}
              onBack={goBack}
            />
          )}
          {currentStep === 3 && (
            <StepConnect
              connected={connected}
              toggle={(id) => {
                const next = new Set(connected);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                setConnected(next);
              }}
              onContinue={() =>
                goNext({ status: "complete", channels: Array.from(connected) })
              }
              onSkip={() => {
                postStep("step3Audience", { status: "skipped", channels: [] });
                setCurrentStep(4);
              }}
            />
          )}
          {currentStep === 4 && (
            <StepCampaign
              selected={template}
              setSelected={setTemplate}
              onRun={() => goNext({ status: "complete", template })}
              onSkip={() => {
                postStep("step4Products", { status: "skipped" });
                setCurrentStep(5);
              }}
            />
          )}
          {currentStep === 5 && (
            <StepDone
              onDashboard={skipToDashboard}
              onTour={() => router.push("/app/overview?tour=1")}
              onInvite={() => router.push("/app?invite=1")}
            />
          )}
        </div>
      </main>

      <footer className="max-w-3xl mx-auto px-6 pb-8 text-center text-[11px] text-ink-400">
        Need a hand? Reach out at{" "}
        <span className="text-ink-600">help@adziga.in</span>
      </footer>
    </div>
  );
}