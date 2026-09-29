import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  home: "index.html",
  environment: "environment/index.html",
  documents: "documents/index.html",
  faq: "faq/index.html",
  feedback: "public-feedback/index.html",
  blog: "blog/index.html",
  post: "blog/public-input-on-south-walton-connector-road-development/index.html",
  header: "header.js",
  wrangler: "wrangler.jsonc",
  pkg: "package.json",
};

const text = {};
for (const [key, path] of Object.entries(files)) {
  text[key] = await readFile(path, "utf8");
}

assert.match(text.home, /The South Walton Connector/);
assert.match(text.home, /September 22, 2025/);
assert.match(text.home, /The Proposed Route/);
assert.match(text.home, /11-foot travel lanes/);
assert.match(text.home, /206 comments opposing and 130 supporting/);
assert.match(text.environment, /Protecting Point Washington State Forest/);
assert.match(text.environment, /limited-access facility/);
assert.match(text.environment, /LOCK 1 — PROTECT THE LAND/);
assert.match(text.environment, /TAKE THE COMMUNITY SURVEY/);
assert.match(text.environment, /route-diagram\.jpg/);
assert.match(text.faq, /What is D2\?/);
assert.match(text.faq, /Has the road been approved for construction\?/);
assert.match(text.faq, /Could development along the road be prohibited\?/);
assert.match(text.documents, /About our sources/);
assert.match(text.documents, /not an official government platform/);
assert.match(text.documents, /Purpose &amp; Need Statement/);
assert.match(text.documents, /purpose-and-need-2019\.pdf/);
assert.match(text.documents, /FY2026–2030/);
assert.equal(text.documents.includes("Document pending"), false);
assert.equal(text.documents.includes("Public Input"), false);
assert.match(text.feedback, /First name/);
assert.match(text.feedback, /TAKE THE COMMUNITY SURVEY BELOW/);
assert.match(text.feedback, /forest-road\.jpg/);
assert.match(text.feedback, />Submit</);
assert.match(text.feedback, /Watersound Parkway/);
assert.match(text.feedback, /Select up to three/);
assert.match(text.feedback, /Point Washington State Forest/);
assert.match(text.feedback, /action="\/api\/feedback"/);
assert.match(text.blog, /Understanding the South Walton Connector Road Project/);
assert.match(text.post, /did not mean the road was approved for construction/);
assert.match(text.post, /permanently protecting Point Washington State Forest/);

for (const key of ["home", "environment", "documents", "faq", "feedback", "blog", "post"]) {
  assert.match(text[key], /header\.js/);
  assert.match(text[key], /footer\.js/);
  assert.equal(text[key].includes("lorem ipsum"), false);
  assert.equal(text[key].includes("TODO"), false);
  assert.equal(text[key].includes("placeholder"), false);
}

assert.match(text.header, /Home/);
assert.match(text.header, /Environment/);
assert.match(text.header, /Documents/);
assert.match(text.header, /FAQ/);
assert.match(text.header, /Community Survey/);
assert.match(text.header, /public-feedback/);
assert.match(text.header, /Blog/);
assert.match(text.wrangler, /"name": "southwaltonconnect"/);
assert.match(text.wrangler, /"directory": "\."/);
assert.match(text.pkg, /"name": "southwaltonconnect"/);

const pdfs = [
  "documents/purpose-and-need-2019.pdf",
  "documents/public-meeting-handout-2019.pdf",
  "documents/typical-sections-2019.pdf",
  "documents/april-18-2023-meeting-handout.pdf",
  "documents/evaluation-matrix-2023.pdf",
  "documents/fy2024-2028-five-year-work-plan.pdf",
  "documents/fy2025-2029-five-year-work-plan.pdf",
  "documents/fy2026-2030-five-year-work-plan.pdf",
  "documents/2045-okaloosa-walton-lrtp.pdf",
];
for (const path of pdfs) {
  const bytes = await readFile(path);
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-", path);
}

const homeBytes = await readFile("index.html");
assert.ok(homeBytes.length > 1000);

console.log("ok pages");
