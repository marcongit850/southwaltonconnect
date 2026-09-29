import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const ORIGIN = "https://southwaltonconnect.com";

const pages = [
  ["index.html", `${ORIGIN}/`, "images/timeline-map.jpg", 1600, 1287, "image/jpeg", "website"],
  ["environment/index.html", `${ORIGIN}/environment/`, "images/route-diagram.jpg", 1600, 534, "image/jpeg", "website"],
  ["public-feedback/index.html", `${ORIGIN}/public-feedback/`, "images/forest-road.jpg", 1800, 1012, "image/jpeg", "website"],
  ["faq/index.html", `${ORIGIN}/faq/`, "images/route-diagram.jpg", 1600, 534, "image/jpeg", "website"],
  ["blog/index.html", `${ORIGIN}/blog/`, "images/blog-forest.jpg", 1600, 900, "image/jpeg", "website"],
  ["blog/public-input-on-south-walton-connector-road-development/index.html", `${ORIGIN}/blog/public-input-on-south-walton-connector-road-development/`, "images/blog-forest.jpg", 1600, 900, "image/jpeg", "article"],
  ["documents/index.html", `${ORIGIN}/documents/`, "images/timeline-map.jpg", 1600, 1287, "image/jpeg", "website"],
];

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function decode(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function attr(html, pattern) {
  const match = html.match(pattern);
  assert.ok(match, pattern.toString());
  return decode(match[1]);
}

function jsonLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">\n([\s\S]*?)\n  <\/script>/g)];
  assert.equal(blocks.length, 1, "expected one JSON-LD block");
  return JSON.parse(blocks[0][1]);
}

function imageSize(rel) {
  const bytes = readFileSync(join(root, rel));
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), type: "image/png" };
  }
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5), type: "image/jpeg" };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  assert.fail("jpeg size not found " + rel);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const titles = new Set();
const descriptions = new Set();
const keywordBlob = [];

for (const [file, url, image, width, height, imageType, ogType] of pages) {
  const html = read(file);
  const title = attr(html, /<title>([^<]+)<\/title>/);
  const description = attr(html, /<meta name="description" content="([^"]+)">/);
  assert.equal(titles.has(title), false, "duplicate title " + title);
  assert.equal(descriptions.has(description), false, "duplicate description " + description);
  titles.add(title);
  descriptions.add(description);
  assert.ok(title.length >= 20 && title.length <= 70, file + " title length " + title.length);
  assert.ok(description.length >= 110 && description.length <= 170, file + " description length " + description.length);
  assert.equal((description.match(/South Walton Connector/g) || []).length <= 1, true, file);
  keywordBlob.push(title + " " + description);

  assert.equal(attr(html, /<link rel="canonical" href="([^"]+)">/), url);
  assert.equal(attr(html, /<meta property="og:title" content="([^"]+)">/), title);
  assert.equal(attr(html, /<meta property="og:description" content="([^"]+)">/), description);
  assert.equal(attr(html, /<meta property="og:url" content="([^"]+)">/), url);
  assert.equal(attr(html, /<meta property="og:image" content="([^"]+)">/), `${ORIGIN}/${image}`);
  assert.equal(attr(html, /<meta property="og:image:width" content="([^"]+)">/), String(width));
  assert.equal(attr(html, /<meta property="og:image:height" content="([^"]+)">/), String(height));
  assert.equal(attr(html, /<meta property="og:image:type" content="([^"]+)">/), imageType);
  assert.equal(attr(html, /<meta property="og:type" content="([^"]+)">/), ogType);
  assert.equal(attr(html, /<meta property="og:site_name" content="([^"]+)">/), "South Walton Connect");
  assert.equal(attr(html, /<meta property="og:locale" content="([^"]+)">/), "en_US");
  assert.equal(attr(html, /<meta name="twitter:card" content="([^"]+)">/), "summary_large_image");
  assert.equal(attr(html, /<meta name="twitter:title" content="([^"]+)">/), title);
  assert.equal(attr(html, /<meta name="twitter:description" content="([^"]+)">/), description);
  assert.equal(attr(html, /<meta name="twitter:image" content="([^"]+)">/), `${ORIGIN}/${image}`);
  const imageAlt = attr(html, /<meta property="og:image:alt" content="([^"]+)">/);
  assert.ok(imageAlt.length > 10, file);
  assert.equal(attr(html, /<meta name="twitter:image:alt" content="([^"]+)">/), imageAlt);
  assert.equal(html.includes("noindex"), false, file);

  const size = imageSize(image);
  assert.equal(size.width, width, image);
  assert.equal(size.height, height, image);
  assert.equal(size.type, imageType, image);

  const data = jsonLd(html);
  assert.equal(data["@context"], "https://schema.org");
  const serialized = JSON.stringify(data);
  assert.equal(serialized.includes("LocalBusiness"), false, file);
  assert.equal(serialized.includes("streetAddress"), false, file);
  assert.equal(serialized.includes("telephone"), false, file);
  const h1s = html.match(/<h1[\s>]/g) || [];
  assert.equal(h1s.length, 1, file + " h1 count");
}

const joined = keywordBlob.join("\n");
assert.match(joined, /South Walton Connector/);
assert.match(joined, /Scenic (Highway )?30A/);
assert.match(joined, /US 98/);
assert.match(joined, /Walton County/);

const home = jsonLd(read("index.html"));
assert.deepEqual(home["@graph"].map((node) => node["@type"]), ["Organization", "WebSite", "WebPage"]);
const org = home["@graph"][0];
assert.equal(org.name, "South Walton Connect");
assert.equal(org.url, `${ORIGIN}/`);
assert.match(org.description, /Not an official Walton County, Florida website/);
assert.equal(org.logo.url, `${ORIGIN}/images/logo.png`);
assert.equal(org.logo.width, 900);
assert.equal(org.logo.height, 462);
assert.deepEqual(imageSize("images/logo.png"), { width: 900, height: 462, type: "image/png" });
assert.equal(home["@graph"][1]["@type"], "WebSite");
assert.equal(home["@graph"][1].publisher["@id"], `${ORIGIN}/#organization`);

const faqHtml = read("faq/index.html");
const questions = [...faqHtml.matchAll(/<summary>(.*?)<\/summary>/g)].map((match) => decode(match[1].trim()));
const answers = [...faqHtml.matchAll(/<summary>.*?<\/summary>\s*<p>(.*?)<\/p>/g)].map((match) => decode(match[1].trim()));
const faq = jsonLd(faqHtml)["@graph"].find((node) => node["@type"] === "FAQPage");
assert.equal(faq.mainEntity.length, questions.length);
assert.equal(questions.length, 6);
faq.mainEntity.forEach((item, index) => {
  assert.equal(item.name, questions[index]);
  assert.equal(item.acceptedAnswer.text, answers[index]);
});
assert.equal(jsonLd(faqHtml)["@graph"].some((node) => node["@type"] === "BreadcrumbList"), true);

for (const file of ["environment/index.html", "public-feedback/index.html", "blog/index.html", "documents/index.html"]) {
  const types = jsonLd(read(file))["@graph"].map((node) => node["@type"]);
  assert.equal(types.includes("BreadcrumbList"), true, file);
  assert.equal(types.at(-1), "BreadcrumbList", file);
}

const documents = jsonLd(read("documents/index.html"));
assert.equal(documents["@graph"][0]["@type"], "CollectionPage");
const docList = documents["@graph"].find((node) => node["@type"] === "ItemList");
const docHeadings = [...read("documents/index.html").matchAll(/<article class="doc-card">[\s\S]*?<h3>(.*?)<\/h3>/g)]
  .map((match) => decode(match[1].trim()));
assert.deepEqual(docList.itemListElement.map((item) => item.name), docHeadings);
assert.equal(docList.numberOfItems, 8);
assert.equal(JSON.stringify(documents).includes("Document pending"), false);

const blog = jsonLd(read("blog/index.html"))["@graph"].find((node) => node["@type"] === "Blog");
assert.equal(blog.blogPost.length, 1);
assert.equal(blog.blogPost[0].url, `${ORIGIN}/blog/public-input-on-south-walton-connector-road-development/`);
assert.equal(blog.blogPost[0].datePublished, "2026-09-17");
assert.equal(blog.blogPost[0].dateModified, "2026-09-18");

const postHtml = read("blog/public-input-on-south-walton-connector-road-development/index.html");
const post = jsonLd(postHtml)["@graph"].find((node) => node["@type"] === "BlogPosting");
assert.equal(post.headline, "Understanding the South Walton Connector Road Project");
assert.equal(post.datePublished, "2026-09-17");
assert.equal(post.dateModified, "2026-09-18");
assert.equal(post.author.name, "South Walton Connect");
assert.match(postHtml, /September 17, 2026/);
assert.match(postHtml, /Updated September 18, 2026/);
assert.equal(attr(postHtml, /<meta property="article:published_time" content="([^"]+)">/), "2026-09-17");
assert.equal(attr(postHtml, /<meta property="article:modified_time" content="([^"]+)">/), "2026-09-18");

const robots = read("robots.txt");
assert.match(robots, /User-agent: \*\nAllow: \/\n/);
assert.match(robots, /Sitemap: https:\/\/southwaltonconnect\.com\/sitemap\.xml/);

const sitemap = read("sitemap.xml");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.deepEqual(locs, pages.map(([, url]) => url));
assert.equal(locs.some((url) => url.includes("/groups")), false);
assert.equal(sitemap.includes("/api/"), false);

const ignore = read(".assetsignore");
assert.equal(ignore.includes("robots.txt"), false);
assert.equal(ignore.includes("sitemap.xml"), false);
const wrangler = read("wrangler.jsonc");
assert.match(wrangler, /"name": "southwaltonconnect"/);
assert.match(wrangler, /"directory": "\."/);
assert.match(wrangler, /"run_worker_first": \["\/api\/feedback", "\/api\/feedback\/"\]/);
assert.equal(wrangler.includes("sitemap"), false);
assert.equal(wrangler.includes("robots"), false);

const htmlFiles = walk(root).filter((path) => path.endsWith(".html"));
assert.equal(htmlFiles.length, pages.length);
for (const path of walk(root)) {
  if (!path.endsWith(".html") && !path.endsWith(".js")) continue;
  const html = readFileSync(path, "utf8");
  for (const match of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = match[0];
    const alt = tag.match(/\salt="([^"]*)"/);
    assert.ok(alt, "missing alt " + path);
    assert.ok(alt[1].trim().length > 0, "empty alt " + path);
  }
}

console.log("ok seo");
