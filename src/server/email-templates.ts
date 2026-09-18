// Adziga — Email templates
// Plain HTML, inline CSS. Production should use a proper template engine (MJML/React Email).

type Rendered = { subject: string; html: string; text: string };

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif; background: #f6f7f9; margin: 0; padding: 32px; color: #0d1015; }
.wrap { max-width: 560px; margin: 0 auto; }
.card { background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.05); }
.brand { color: #243ff0; font-weight: 700; letter-spacing: -0.02em; font-size: 18px; margin-bottom: 24px; }
h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 16px 0; }
p { font-size: 15px; line-height: 1.6; margin: 0 0 16px 0; color: #43495a; }
.btn { display: inline-block; background: #243ff0; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 16px 0; }
.muted { font-size: 13px; color: #677289; }
.code { background: #f6f7f9; padding: 12px; border-radius: 6px; font-family: ui-monospace, monospace; font-size: 13px; word-break: break-all; }
.footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eceef2; font-size: 12px; color: #8791a7; }
</style></head><body>
<div class="wrap"><div class="card">
<div class="brand">Adziga</div>
${body}
<div class="footer">Adziga — Marketing Operating System<br>You are receiving this because you signed up at adziga.in. <a href="{{unsubscribe}}">Unsubscribe</a></div>
</div></div></body></html>`;
}

const text = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

const TEMPLATES: Record<string, (vars: any) => Rendered> = {
  welcome: (v) => ({
    subject: `Welcome to Adziga, ${v.name ?? "there"}`,
    html: wrap("Welcome to Adziga", `
      <h1>Welcome to ${v.name ?? "Adziga"}</h1>
      <p>Thanks for signing up. Your account is ready and you can start exploring the platform.</p>
      <p>To get the most out of Adziga, start by connecting your ad accounts and inviting your team.</p>
      <a href="${v.appUrl ?? "https://app.adziga.in"}/onboarding" class="btn">Complete onboarding</a>
      <p class="muted">If you have any questions, reply to this email and we'll help you get set up.</p>
    `),
    text: `Welcome to Adziga. Complete onboarding at ${v.appUrl}/onboarding`
  }),

  verify_email: (v) => ({
    subject: "Verify your email address",
    html: wrap("Verify your email", `
      <h1>Verify your email</h1>
      <p>Click the button below to verify your email address and unlock all features.</p>
      <a href="${v.verifyUrl}" class="btn">Verify email</a>
      <p class="muted">If the button doesn't work, paste this link in your browser:</p>
      <div class="code">${v.verifyUrl}</div>
      <p class="muted">This link expires in 24 hours.</p>
    `),
    text: `Verify your email: ${v.verifyUrl}`
  }),

  password_reset: (v) => ({
    subject: "Reset your Adziga password",
    html: wrap("Reset password", `
      <h1>Reset your password</h1>
      <p>Someone (hopefully you) requested a password reset for ${v.email}.</p>
      <a href="${v.resetUrl}" class="btn">Reset password</a>
      <p class="muted">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `),
    text: `Reset your password: ${v.resetUrl}`
  }),

  mfa_enabled: (v) => ({
    subject: "Two-factor authentication enabled",
    html: wrap("MFA enabled", `
      <h1>Two-factor authentication is on</h1>
      <p>Your Adziga account is now protected by an authenticator app.</p>
      <p class="muted">If you didn't enable this, contact support immediately.</p>
    `),
    text: "Two-factor authentication enabled on your Adziga account"
  }),

  payment_failed: (v) => ({
    subject: "Payment failed - action required",
    html: wrap("Payment failed", `
      <h1>We couldn't process your payment</h1>
      <p>Your ${v.plan} subscription payment of INR ${v.amount} failed.</p>
      <p>Reason: ${v.reason ?? "Card declined"}</p>
      <a href="${v.appUrl}/app/admin/billing" class="btn">Update payment method</a>
      <p class="muted">Your subscription will be paused if payment is not received within 7 days.</p>
    `),
    text: `Payment failed. Update at ${v.appUrl}/app/admin/billing`
  }),

  weekly_report: (v) => ({
    subject: `Your Adziga weekly report - ${v.weekOf}`,
    html: wrap("Weekly report", `
      <h1>Week of ${v.weekOf}</h1>
      <p>Here's how your marketing performed this week:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #eceef2;">Spend</td><td style="padding:8px 0;border-bottom:1px solid #eceef2;text-align:right;font-weight:600;">INR ${v.spend}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eceef2;">Leads</td><td style="padding:8px 0;border-bottom:1px solid #eceef2;text-align:right;font-weight:600;">${v.leads}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eceef2;">CPL</td><td style="padding:8px 0;border-bottom:1px solid #eceef2;text-align:right;font-weight:600;">INR ${v.cpl}</td></tr>
        <tr><td style="padding:8px 0;">ROAS</td><td style="padding:8px 0;text-align:right;font-weight:600;">${v.roas}x</td></tr>
      </table>
      <a href="${v.appUrl}/app/overview" class="btn">Open dashboard</a>
    `),
    text: `Weekly: INR ${v.spend} spend, ${v.leads} leads, INR ${v.cpl} CPL, ${v.roas}x ROAS`
  }),

  campaign_alert: (v) => ({
    subject: `Campaign alert: ${v.campaignName}`,
    html: wrap("Campaign alert", `
      <h1>${v.campaignName} needs attention</h1>
      <p>${v.reason}</p>
      <a href="${v.appUrl}/app/campaigns/${v.campaignId}" class="btn">View campaign</a>
    `),
    text: `Campaign ${v.campaignName}: ${v.reason}`
  })
};

export function renderTemplate(template: string, variables: Record<string, any>): Rendered {
  const tpl = TEMPLATES[template];
  if (!tpl) {
    return {
      subject: variables.subject ?? "Adziga notification",
      html: `<p>${JSON.stringify(variables)}</p>`,
      text: JSON.stringify(variables)
    };
  }
  return tpl(variables);
}