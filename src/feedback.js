// POST /api/feedback
// The destination inbox is CONTACT_EMAIL, a Worker variable or secret.
// Delivery uses the Resend HTTP API with RESEND_API_KEY. Neither value is
// returned to the browser.
//
// FROM is Resend's free onboarding sender, which works without a verified
// domain. It can deliver only to the Resend account's own address until a
// domain is verified. After that, switch FROM to an address on the verified
// domain (for example "South Walton Connect <hello@southwaltonconnect.com>").

const MAX_BODY = 24000;
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 5;
const RESEND_URL = "https://api.resend.com/emails";
const FROM = "South Walton Connect <onboarding@resend.dev>";
const recentHits = new Map();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const QUESTIONS = [
  ["connection", "Connection to South Walton"],
  ["area", "Area most closely associated with"],
  ["congestion", "Seriousness of congestion on Scenic Highway 30A"],
  ["watersound", "Awareness that Watersound Parkway is a private road"],
  ["needs_connector", "Need for another public north-south connection"],
  ["issues", "Transportation issues (up to three)"],
  ["d2_opinion", "Opinion of the proposed D2 corridor"],
  ["protections_required", "Should permanent protections be required"],
  ["protections_effect", "Effect of development protections on opinion of D2"],
  ["support_if_prohibited", "Support for D2 if development were permanently prohibited"],
  ["limited_access_effect", "Effect of limited access on opinion of D2"],
  ["closest_statement", "Closest statement"],
  ["concerns", "Concerns, conditions, alternatives, or ideas"],
  ["email", "Email for updates"],
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function html(body, status) {
  const heading = body.ok ? "Survey received" : "Survey not sent";
  const text = body.ok
    ? "Thank you. Your response is on its way."
    : body.error || "Could not send that response. Please try again.";
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(heading)} · South Walton Connect</title>
</head>
<body>
  <main>
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(text)}</p>
    <p><a href="/public-feedback/">Back to the survey</a></p>
  </main>
</body>
</html>`;
  return new Response(page, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function clientIp(request) {
  return request.headers.get("cf-connecting-ip") || "unknown";
}

function rateLimited(ip) {
  const now = Date.now();
  const stamps = (recentHits.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (stamps.length >= MAX_PER_WINDOW) {
    recentHits.set(ip, stamps);
    return true;
  }
  stamps.push(now);
  recentHits.set(ip, stamps);
  if (recentHits.size > 1000) {
    for (const [key, times] of recentHits) {
      const fresh = times.filter((time) => now - time < WINDOW_MS);
      if (fresh.length) recentHits.set(key, fresh);
      else recentHits.delete(key);
    }
  }
  return false;
}

function singleLine(value) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function asList(value) {
  const raw = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  return raw.map(singleLine).filter(Boolean);
}

function resendApiKey(env) {
  const key = typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.trim() : "";
  if (!key || /\s/.test(key)) return "";
  return key;
}

function resendFailure(status, result) {
  const name = result && typeof result.name === "string" ? result.name : "";
  const quota = name === "daily_quota_exceeded" || name === "monthly_quota_exceeded";
  const rateLimitedByResend = status === 429 || name === "rate_limit_exceeded" || quota;

  if (rateLimitedByResend) {
    return {
      status: 429,
      error: quota ? "Please try again later." : "Please wait a minute and try again.",
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    name === "missing_api_key" ||
    name === "restricted_api_key" ||
    name === "suspended_api_key"
  ) {
    return { status: 503, error: "The survey is not available right now." };
  }

  if (
    status === 400 ||
    status === 422 ||
    name === "validation_error" ||
    name === "invalid_parameter" ||
    name === "missing_required_field"
  ) {
    return {
      status: 400,
      error: "Could not send that response. Please check the form and try again.",
    };
  }

  return { status: 502, error: "Could not send that response. Please try again." };
}

function surveyText(firstName, answers, email) {
  const lines = [`First name: ${firstName || "(not provided)"}`];
  for (const [key, label] of QUESTIONS) {
    if (key === "email") continue;
    const value = answers[key];
    const shown = Array.isArray(value) ? value.join("; ") : value;
    lines.push(`${label}: ${shown || "(not answered)"}`);
  }
  lines.push(`Email for updates: ${email || "(not provided)"}`);
  return lines.join("\n");
}

function readForm(data) {
  const answers = {};
  for (const [key] of QUESTIONS) {
    if (key === "connection" || key === "issues") answers[key] = asList(data[key]);
    else if (key === "concerns") answers[key] = String(data[key] ?? "").replace(/\u0000/g, "").trim();
    else if (key === "email") answers[key] = singleLine(data[key]);
    else answers[key] = singleLine(data[key]);
  }
  return {
    firstName: singleLine(data.first_name),
    answers,
    email: answers.email,
  };
}

export async function handleFeedback(request, env = {}) {
  const accept = (request.headers.get("accept") || "").toLowerCase();
  const type = (request.headers.get("content-type") || "").toLowerCase();
  const asJson = type.includes("application/json") || accept.includes("application/json");
  const reply = (body, status) => (asJson ? json(body, status) : html(body, status));

  if (request.method !== "POST") {
    return reply({ ok: false, error: "Use the survey form to send a response." }, 405);
  }

  const lengthHeader = Number(request.headers.get("content-length") || 0);
  if (lengthHeader > MAX_BODY) {
    return reply({ ok: false, error: "That response is too long." }, 413);
  }

  const isJson = type.includes("application/json");
  const isForm = type.includes("application/x-www-form-urlencoded");
  if (!isJson && !isForm) {
    return reply({ ok: false, error: "Could not read that response." }, 415);
  }

  if (rateLimited(clientIp(request))) {
    return reply({ ok: false, error: "Please wait a minute and try again." }, 429);
  }

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return reply({ ok: false, error: "Could not read that response." }, 400);
  }
  if (!raw.trim()) {
    return reply({ ok: false, error: "Please add a response." }, 400);
  }
  if (raw.length > MAX_BODY) {
    return reply({ ok: false, error: "That response is too long." }, 413);
  }

  let data;
  try {
    if (isJson) {
      data = JSON.parse(raw);
    } else {
      const params = new URLSearchParams(raw);
      data = {};
      for (const key of new Set(params.keys())) {
        const all = params.getAll(key);
        data[key] = all.length > 1 ? all : all[0];
      }
    }
  } catch {
    return reply({ ok: false, error: "Could not read that response." }, 400);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return reply({ ok: false, error: "Could not read that response." }, 400);
  }

  const honeypot = singleLine(data.hp_field || data.company || data.website);
  if (honeypot) {
    return reply({ ok: false, error: "Could not send that response." }, 400);
  }

  const { firstName, answers, email } = readForm(data);
  const answered =
    firstName ||
    email ||
    answers.concerns ||
    answers.connection.length ||
    answers.issues.length ||
    QUESTIONS.some(([key]) => {
      if (key === "connection" || key === "issues" || key === "concerns" || key === "email") return false;
      return Boolean(answers[key]);
    });
  if (!answered) return reply({ ok: false, error: "Please add a response." }, 400);
  if (firstName.length > 80) return reply({ ok: false, error: "That name is too long." }, 400);
  if (email && (!EMAIL_RE.test(email) || email.length > 254)) {
    return reply({ ok: false, error: "Please enter a valid email address, or leave email blank." }, 400);
  }
  if (answers.issues.length > 3) {
    return reply({ ok: false, error: "Select up to three transportation issues." }, 400);
  }
  if (answers.connection.length > 8) {
    return reply({ ok: false, error: "Could not send that response." }, 400);
  }
  for (const [key] of QUESTIONS) {
    const value = answers[key];
    if (Array.isArray(value)) {
      if (value.some((item) => item.length > 240)) {
        return reply({ ok: false, error: "That response is too long." }, 400);
      }
    } else if (key === "concerns") {
      if (value.length > 4000) return reply({ ok: false, error: "That comment is too long." }, 400);
    } else if (key !== "email" && value.length > 400) {
      return reply({ ok: false, error: "That response is too long." }, 400);
    }
  }

  const to = typeof env.CONTACT_EMAIL === "string" ? env.CONTACT_EMAIL.trim() : "";
  if (!to || !EMAIL_RE.test(to)) {
    return reply({ ok: false, error: "The survey is not available right now." }, 503);
  }

  const apiKey = resendApiKey(env);
  if (!apiKey) {
    return reply({ ok: false, error: "The survey is not available right now." }, 503);
  }

  const payload = {
    from: FROM,
    to: [to],
    subject: firstName
      ? `South Walton Connect survey from ${firstName}`
      : "South Walton Connect community survey",
    text: surveyText(firstName, answers, email),
  };
  if (email) payload.reply_to = email;

  let upstream;
  try {
    upstream = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return reply({ ok: false, error: "Could not send that response. Please try again." }, 502);
  }

  let result = null;
  try {
    result = await upstream.json();
  } catch {
    result = null;
  }

  const delivered =
    upstream.ok && result && typeof result.id === "string" && result.id.trim().length > 0;
  if (!delivered) {
    const failure = resendFailure(upstream.status, result);
    return reply({ ok: false, error: failure.error }, failure.status);
  }

  return reply({ ok: true }, 200);
}
