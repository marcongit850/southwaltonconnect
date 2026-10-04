import assert from "node:assert/strict";
import { handleFeedback } from "../src/feedback.js";
import worker from "../src/worker.js";

const INBOX = "inbox@example.com";
const API_KEY = "re_test_secret";
const RESEND_URL = "https://api.resend.com/emails";
const FROM = "South Walton Connect <onboarding@resend.dev>";
let fetchCalls = [];
const realFetch = globalThis.fetch;

function installFetch(handler) {
  fetchCalls = [];
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    return handler(url, init);
  };
}

function restoreFetch() {
  globalThis.fetch = realFetch;
}

async function post(body, {
  ip = "203.0.113.10",
  env = { CONTACT_EMAIL: INBOX, RESEND_API_KEY: API_KEY },
  headers,
  ctx,
} = {}) {
  const request = new Request("https://southwaltonconnect.com/api/feedback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "cf-connecting-ip": ip,
      ...(headers || {}),
    },
    body: JSON.stringify(body),
  });
  const response = await handleFeedback(request, env, ctx);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { response, text, json };
}

function okResend() {
  return new Response(JSON.stringify({ id: "email_123" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const valid = {
  first_name: "Ada",
  connection: ["I live in South Walton full-time"],
  area: "Scenic 30A area",
  congestion: "Very serious",
  watersound: "Yes, I was aware",
  needs_connector: "Support",
  issues: ["Traffic congestion", "Environmental impacts"],
  d2_opinion: "Neutral / need more information",
  protections_required: "Definitely yes",
  protections_effect: "Much more supportive",
  support_if_prohibited: "Probably yes",
  limited_access_effect: "Somewhat more supportive",
  closest_statement: "I need more information before forming an opinion.",
  concerns: "Keep the forest from becoming a development corridor.",
  email: "",
  hp_field: "",
};

let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log("ok", name);
  } catch (error) {
    console.error("FAIL", name);
    console.error(error);
    process.exitCode = 1;
  } finally {
    restoreFetch();
  }
}

await check("sends a survey without requiring email", async () => {
  installFetch(async () => okResend());
  const { response, json } = await post(valid, { ip: "203.0.113.40" });
  assert.equal(response.status, 200);
  assert.equal(json.ok, true);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, RESEND_URL);
  const payload = JSON.parse(fetchCalls[0].init.body);
  assert.equal(payload.from, FROM);
  assert.deepEqual(payload.to, [INBOX]);
  assert.equal(payload.reply_to, undefined);
  assert.match(payload.text, /First name: Ada/);
  assert.match(payload.text, /Traffic congestion; Environmental impacts/);
  assert.match(payload.text, /Email for updates: \(not provided\)/);
  assert.equal(payload.text.includes(INBOX), false);
  assert.equal(payload.text.includes(API_KEY), false);
});

await check("sets reply-to when an email is provided", async () => {
  installFetch(async () => okResend());
  const { response } = await post(
    { ...valid, email: "ada@example.com" },
    { ip: "203.0.113.41" },
  );
  assert.equal(response.status, 200);
  const payload = JSON.parse(fetchCalls[0].init.body);
  assert.equal(payload.reply_to, "ada@example.com");
});

await check("accepts a survey without a first name", async () => {
  installFetch(async () => okResend());
  const { response, json } = await post({ ...valid, first_name: "  " }, { ip: "203.0.113.42" });
  assert.equal(response.status, 200);
  assert.equal(json.ok, true);
  const payload = JSON.parse(fetchCalls[0].init.body);
  assert.equal(payload.subject, "South Walton Connect community survey");
  assert.match(payload.text, /First name: \(not provided\)/);
});

await check("rejects a survey with no answers", async () => {
  installFetch(async () => { throw new Error("should not send"); });
  const { response, json } = await post({
    first_name: "",
    connection: [],
    issues: [],
    concerns: "",
    email: "",
    hp_field: "",
  }, { ip: "203.0.113.48" });
  assert.equal(response.status, 400);
  assert.match(json.error, /response/i);
  assert.equal(fetchCalls.length, 0);
});

await check("rejects an invalid optional email", async () => {
  installFetch(async () => { throw new Error("should not send"); });
  const { response, json } = await post({ ...valid, email: "not-an-email" }, { ip: "203.0.113.43" });
  assert.equal(response.status, 400);
  assert.match(json.error, /email/i);
});

await check("rejects more than three transportation issues", async () => {
  installFetch(async () => { throw new Error("should not send"); });
  const { response, json } = await post({
    ...valid,
    issues: ["Traffic congestion", "Environmental impacts", "Development pressure", "Other"],
  }, { ip: "203.0.113.44" });
  assert.equal(response.status, 400);
  assert.match(json.error, /three/);
});

await check("rejects a filled honeypot", async () => {
  installFetch(async () => { throw new Error("should not send"); });
  const { response } = await post({ ...valid, hp_field: "http://spam.test" }, { ip: "203.0.113.45" });
  assert.equal(response.status, 400);
  assert.equal(fetchCalls.length, 0);
});

await check("returns 503 when secrets are missing", async () => {
  installFetch(async () => { throw new Error("should not send"); });
  const { response, json } = await post(valid, { ip: "203.0.113.46", env: {} });
  assert.equal(response.status, 503);
  assert.equal(json.error.includes("@"), false);
});

await check("worker sends feedback and leaves other paths to assets", async () => {
  installFetch(async () => okResend());
  const feedback = await worker.fetch(new Request("https://southwaltonconnect.com/api/feedback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "cf-connecting-ip": "203.0.113.47",
    },
    body: JSON.stringify(valid),
  }), { CONTACT_EMAIL: INBOX, RESEND_API_KEY: API_KEY });
  assert.equal(feedback.status, 200);

  const asset = await worker.fetch(new Request("https://southwaltonconnect.com/"), {
    ASSETS: {
      fetch: async () => new Response("home", { status: 200, headers: { "content-type": "text/html" } }),
    },
  });
  assert.equal(await asset.text(), "home");
});

const SHEET_URL = "https://sheets.example.test/exec";
const SHEET_TOKEN = "sheet-token";
const SHEET_FIELDS = [
  "token",
  "first_name",
  "email",
  "connection",
  "area",
  "congestion",
  "watersound",
  "needs_connector",
  "issues",
  "d2_opinion",
  "protections_required",
  "protections_effect",
  "support_if_prohibited",
  "limited_access_effect",
  "closest_statement",
  "concerns",
];

function sheetEnv(extra = {}) {
  return {
    CONTACT_EMAIL: INBOX,
    RESEND_API_KEY: API_KEY,
    GOOGLE_SHEETS_WEBHOOK_URL: SHEET_URL,
    GOOGLE_SHEETS_WEBHOOK_TOKEN: SHEET_TOKEN,
    ...extra,
  };
}

function installSheetFetch(sheetResponse) {
  installFetch(async (url, init) => {
    if (url === RESEND_URL) return okResend();
    return sheetResponse(url, init);
  });
}

await check("posts one string row after Resend accepts the survey", async () => {
  installSheetFetch(async () => new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
  const { response, json } = await post({
    ...valid,
    connection: ["I live in South Walton full-time", "I own property in South Walton"],
    issues: ["Traffic congestion", "Environmental impacts"],
    email: "ada@example.com",
    concerns: "Keep the forest.\nNo new driveways.",
    hp_field: "",
  }, { ip: "203.0.113.60", env: sheetEnv() });
  assert.equal(response.status, 200);
  assert.equal(json.ok, true);
  assert.equal(fetchCalls.length, 2);
  assert.equal(fetchCalls[0].url, RESEND_URL);
  assert.equal(fetchCalls[1].url, SHEET_URL);
  assert.equal(fetchCalls[1].init.method, "POST");
  assert.equal(fetchCalls[1].init.headers["content-type"], "application/json");
  const row = JSON.parse(fetchCalls[1].init.body);
  assert.deepEqual(Object.keys(row), SHEET_FIELDS);
  assert.equal(row.token, SHEET_TOKEN);
  assert.equal(row.first_name, "Ada");
  assert.equal(row.email, "ada@example.com");
  assert.equal(row.connection, "I live in South Walton full-time, I own property in South Walton");
  assert.equal(row.area, "Scenic 30A area");
  assert.equal(row.congestion, "Very serious");
  assert.equal(row.watersound, "Yes, I was aware");
  assert.equal(row.needs_connector, "Support");
  assert.equal(row.issues, "Traffic congestion, Environmental impacts");
  assert.equal(row.d2_opinion, "Neutral / need more information");
  assert.equal(row.protections_required, "Definitely yes");
  assert.equal(row.protections_effect, "Much more supportive");
  assert.equal(row.support_if_prohibited, "Probably yes");
  assert.equal(row.limited_access_effect, "Somewhat more supportive");
  assert.equal(row.closest_statement, "I need more information before forming an opinion.");
  assert.equal(row.concerns, "Keep the forest.\nNo new driveways.");
  assert.equal(Object.prototype.hasOwnProperty.call(row, "hp_field"), false);
  for (const key of SHEET_FIELDS) assert.equal(typeof row[key], "string");
  const mail = JSON.parse(fetchCalls[0].init.body);
  assert.equal(mail.text.includes(SHEET_TOKEN), false);
  assert.equal(mail.text.includes(SHEET_URL), false);
  assert.match(mail.text, /Traffic congestion; Environmental impacts/);
});

await check("sends empty optional fields as empty strings", async () => {
  installSheetFetch(async () => new Response("ok", { status: 200 }));
  const { response, json } = await post({
    first_name: "",
    connection: [],
    area: "",
    congestion: "",
    watersound: "",
    needs_connector: "",
    issues: [],
    d2_opinion: "",
    protections_required: "",
    protections_effect: "",
    support_if_prohibited: "",
    limited_access_effect: "",
    closest_statement: "",
    concerns: "A connector should avoid the forest.",
    email: "",
    hp_field: "",
  }, { ip: "203.0.113.61", env: sheetEnv() });
  assert.equal(response.status, 200);
  assert.equal(json.ok, true);
  const row = JSON.parse(fetchCalls[1].init.body);
  assert.equal(row.first_name, "");
  assert.equal(row.email, "");
  assert.equal(row.connection, "");
  assert.equal(row.issues, "");
  assert.equal(row.area, "");
  assert.equal(row.concerns, "A connector should avoid the forest.");
  assert.equal(Object.prototype.hasOwnProperty.call(row, "hp_field"), false);
});

await check("skips the sheet when the webhook URL or token is missing", async () => {
  installFetch(async () => okResend());
  const missingToken = await post(valid, {
    ip: "203.0.113.62",
    env: sheetEnv({ GOOGLE_SHEETS_WEBHOOK_TOKEN: "  " }),
  });
  assert.equal(missingToken.response.status, 200);
  assert.equal(missingToken.json.ok, true);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, RESEND_URL);

  installFetch(async () => okResend());
  const missingUrl = await post(valid, {
    ip: "203.0.113.63",
    env: sheetEnv({ GOOGLE_SHEETS_WEBHOOK_URL: "" }),
  });
  assert.equal(missingUrl.response.status, 200);
  assert.equal(missingUrl.json.ok, true);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, RESEND_URL);
});

await check("keeps the form success when the sheet fails", async () => {
  installSheetFetch(async () => new Response("no", { status: 500 }));
  const down = await post(valid, { ip: "203.0.113.64", env: sheetEnv() });
  assert.equal(down.response.status, 200);
  assert.equal(down.json.ok, true);
  assert.equal(fetchCalls[0].url, RESEND_URL);
  assert.equal(fetchCalls[1].url, SHEET_URL);

  installSheetFetch(async () => { throw new Error("sheet down"); });
  const threw = await post(valid, { ip: "203.0.113.65", env: sheetEnv() });
  assert.equal(threw.response.status, 200);
  assert.equal(threw.json.ok, true);
  assert.equal(fetchCalls.length, 2);
  assert.equal(fetchCalls[0].url, RESEND_URL);
});

await check("does not post the sheet when Resend rejects the email", async () => {
  installFetch(async (url) => {
    if (url === SHEET_URL) return new Response("no", { status: 500 });
    return new Response(JSON.stringify({ name: "validation_error" }), { status: 422 });
  });
  const { response, json } = await post(valid, { ip: "203.0.113.66", env: sheetEnv() });
  assert.equal(response.status, 400);
  assert.equal(json.ok, false);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, RESEND_URL);
});

await check("waitUntil posts the sheet without delaying the form response", async () => {
  let releaseSheet = () => {};
  const sheetGate = new Promise((resolve) => {
    releaseSheet = resolve;
  });
  installFetch(async (url) => {
    if (url === SHEET_URL) await sheetGate;
    if (url === RESEND_URL) return okResend();
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  let waited = null;
  try {
    const pending = post({
      ...valid,
      connection: ["I work in South Walton", "Other"],
      issues: ["Emergency response times"],
    }, {
      ip: "203.0.113.67",
      env: sheetEnv(),
      ctx: { waitUntil(promise) { waited = promise; } },
    });
    const result = await Promise.race([
      pending,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("sheet delayed the form response")), 300);
      }),
    ]);
    assert.equal(result.response.status, 200);
    assert.equal(result.json.ok, true);
    assert.equal(fetchCalls[0].url, RESEND_URL);
    assert.ok(waited);
    const row = JSON.parse(fetchCalls[1].init.body);
    assert.equal(row.connection, "I work in South Walton, Other");
    assert.equal(row.issues, "Emergency response times");
  } finally {
    releaseSheet();
  }
  if (waited) await waited;
});

await check("worker passes waitUntil through for the sheet row", async () => {
  installSheetFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  let waited = null;
  const feedback = await worker.fetch(new Request("https://southwaltonconnect.com/api/feedback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "cf-connecting-ip": "203.0.113.68",
    },
    body: JSON.stringify(valid),
  }), sheetEnv(), {
    waitUntil(promise) { waited = promise; },
  });
  assert.equal(feedback.status, 200);
  assert.equal((await feedback.json()).ok, true);
  assert.ok(waited);
  assert.equal(fetchCalls[0].url, RESEND_URL);
  assert.equal(fetchCalls[1].url, SHEET_URL);
  if (waited) await waited;
});

if (process.exitCode) {
  console.error("feedback tests failed");
} else {
  console.log(`passed ${passed}`);
}
