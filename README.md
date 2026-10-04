# South Walton Connect

An independent information site about the proposed South Walton Connector between Scenic Highway 30A and US 98 in Walton County, Florida. The pages adapt the public copy from the earlier Wix site and link the county records that match those document titles.

The Worker name is **`southwaltonconnect`**. Leave that name in `wrangler.jsonc`. Cloudflare Workers Builds for this repository is already tied to a Worker with that exact name. Renaming it creates a different Worker and the existing project stops updating this site.

## Preview

From the repository root:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/`. That server only shows the static pages. Survey delivery is the Worker in `src/worker.js`.

```bash
npm test
```

## Deploy

Cloudflare Workers Builds deploys this repository with `npx wrangler deploy`, using `wrangler.jsonc`.

- `"name"` must stay `southwaltonconnect`.
- `assets.directory` is `.`, so `index.html` at the repository root is the site home page.
- `main` is `src/worker.js`. `assets.run_worker_first` is only `/api/feedback` and `/api/feedback/`. Every other path is a static asset.

`CONTACT_EMAIL` and `RESEND_API_KEY` are Worker variables or secrets. Do not commit them. Mail goes out through the Resend HTTP API. The From address is Resend's free onboarding sender, `South Walton Connect <onboarding@resend.dev>`, which can deliver only to the email address on the Resend account until a domain is verified. Keep `CONTACT_EMAIL` set to that same address. After a domain is verified, change `FROM` in `src/feedback.js`.

`GOOGLE_SHEETS_WEBHOOK_URL` and `GOOGLE_SHEETS_WEBHOOK_TOKEN` are Worker secrets, the same names used by Eating on 30A, Eating in Destin, and Friends of Scenic 30A. Do not commit the URL or the token. After Resend accepts the survey email, the Worker POSTs one JSON row to that webhook. Every field is a string: token, first_name, email, connection, area, congestion, watersound, needs_connector, issues, d2_opinion, protections_required, protections_effect, support_if_prohibited, limited_access_effect, closest_statement, and concerns. connection and issues are the checked labels joined with a comma. Radios are the selected label. Empty optional fields are empty strings. The honeypot is not sent. If either secret is missing, the Worker skips the sheet call and still returns success after the email. A sheet failure does not change the form response. The email is sent before the sheet request starts.

After this change is merged and deployed:

1. Open **Workers & Pages** → **southwaltonconnect** → **Settings** → **Variables and Secrets**.
2. Set `CONTACT_EMAIL` for Production to the Resend account address. Add it for Preview too if that environment is offered.
3. Add `RESEND_API_KEY` as a secret, without a `Bearer` prefix. Add it for Preview too if that environment is offered.
4. Add `GOOGLE_SHEETS_WEBHOOK_URL` and `GOOGLE_SHEETS_WEBHOOK_TOKEN` as secrets. Add them for Preview too if that environment is offered.
5. Redeploy after saving so the Worker picks up the secrets.

Until `CONTACT_EMAIL` and `RESEND_API_KEY` are set, `POST /api/feedback` returns HTTP 503. The form still displays. Missing sheet secrets do not do that: the email still succeeds and the sheet call is skipped.

## How to merge

1. Review this pull request.
2. Merge it into `main`.
3. Let the existing **southwaltonconnect** Workers Builds project deploy `main`. Do not create a second Worker or change the project name.
4. Attach `southwaltonconnect.com` to that Worker if it is not already the custom domain.
5. Set `CONTACT_EMAIL`, `RESEND_API_KEY`, `GOOGLE_SHEETS_WEBHOOK_URL`, and `GOOGLE_SHEETS_WEBHOOK_TOKEN`, then submit a test response on `/public-feedback/`.

## Pages

- `/` is the project timeline (2006 through September 22, 2025) and the D2 preferred route
- `/environment/` covers Point Washington State Forest and the limited-access idea
- `/documents/` links the public county PDFs
- `/faq/`
- `/public-feedback/` is the community survey and posts to `/api/feedback`
- `/blog/` and the September 2026 post

The Wix Groups feature is not part of this version.
