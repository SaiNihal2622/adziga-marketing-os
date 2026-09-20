// Security disclosure — RFC 9116
// https://securitytxt.org/

export function GET() {
  const body = `# Adziga security policy
# Last updated: 2026-09-21

Contact: mailto:security@adziga.in
Contact: mailto:legal@adziga.in
Encryption: https://adziga.in/.well-known/pgp-key.asc
Expires: 2027-09-21T00:00:00.000Z
Preferred-Languages: en, hi
Canonical: https://adziga.in/.well-known/security.txt

# Policy
# We welcome responsible disclosure of security vulnerabilities.
# We commit to:
#   - Acknowledge within 48 hours
#   - Triage within 5 business days
#   - Fix critical issues within 7 days
#   - Credit researchers who report valid issues (with permission)
#
# Scope: adziga.in, *.adziga.in, app.adziga.in, api.adziga.in
# Out of scope: third-party services, social engineering, physical attacks
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400"
    }
  });
}
