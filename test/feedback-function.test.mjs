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
  const response = await handleFeedback(request, env);
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

await check("rejects a missing first name", async () => {
  installFetch(async () => { throw new Error("should not send"); });
  const { response, json } = await post({ ...valid, first_name: "  " }, { ip: "203.0.113.42" });
  assert.equal(response.status, 400);
  assert.match(json.error, /first name/i);
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

if (process.exitCode) {
  console.error("feedback tests failed");
} else {
  console.log(`passed ${passed}`);
}
