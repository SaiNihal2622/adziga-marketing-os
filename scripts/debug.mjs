const base = "http://localhost:3000";

async function login(email, password) {
  const csrfRes = await fetch(base + "/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();
  const cookies = csrfRes.headers.getSetCookie();
  const cookieHeader = cookies.map(c => c.split(";")[0]).join("; ");
  const loginRes = await fetch(base + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader },
    body: new URLSearchParams({ email, password, csrfToken, callbackUrl: base + "/app" }),
    redirect: "manual"
  });
  return [...cookies, ...loginRes.headers.getSetCookie()].map(c => c.split(";")[0]).join("; ");
}

(async () => {
  const cookies = await login("mm@adziga.in", "adziga123");
  const res = await fetch(base + "/app/crm", { headers: { cookie: cookies } });
  const text = await res.text();
  const errIdx = text.indexOf("CRM");
  console.log(text.substring(errIdx, errIdx + 800));
})();