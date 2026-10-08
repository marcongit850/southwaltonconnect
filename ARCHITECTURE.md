# South Walton Connect: architecture

Last checked against the code and Cloudflare on Oct 8, 2026.

## What it does

An independent information site about the proposed South Walton Connector between Scenic Highway 30A and US 98, with county documents, FAQ, and a public feedback survey.

## Domains and Worker

- Worker: `southwaltonconnect`
- Custom domains (attached in the Cloudflare dashboard): `southwaltonconnect.com`, `www.southwaltonconnect.com`
- workers.dev host is enabled.

## Data and images

- Pages and images are static files in this repo. County document PDFs are stored in `documents/`.
- Bindings: `ASSETS` (static assets, directory `.`). No D1, R2, or KV.
- External services: Resend (survey mail), a Google Sheets Apps Script webhook (survey rows), Google Analytics 4 tag on pages.

## Secrets and env vars (names only)

Secrets set: `RESEND_API_KEY`, `CONTACT_EMAIL`, `GOOGLE_SHEETS_WEBHOOK_URL`, `GOOGLE_SHEETS_WEBHOOK_TOKEN`.

## Cron and scheduled jobs

None. The Worker has only a fetch handler and no cron trigger.

## How it deploys

- Cloudflare Workers Builds, auto deploy on merge to `main`. Repo `marcongit850/southwaltonconnect`, trigger `c59e1fc6-96ae-477e-b3ce-722633140297`, build command empty, deploy command `npx wrangler deploy`, root `/`.
- If a merge does not deploy: `POST /accounts/f1c59948520f1ec39473238b621c7e24/builds/triggers/c59e1fc6-96ae-477e-b3ce-722633140297/builds` with body `{"branch": "main", "commit_hash": "<full 40 character sha>"}`. Check builds with `GET /accounts/f1c59948520f1ec39473238b621c7e24/builds/workers/6a474abebfea4c36a1bc4ab68c68d428/builds?per_page=2` and match `commit_hash`.

## Known gotchas

- Keep the Worker name `southwaltonconnect`. Renaming it creates a new Worker and the Workers Builds project stops updating the site.
- Only `/api/feedback` runs the Worker (`run_worker_first`). Static pages stay on the free asset path.
- Contact mail is sent from Resend's onboarding sender (`South Walton Connect <onboarding@resend.dev>`), hardcoded in the code. That sender only delivers to the email on the Resend account, so `CONTACT_EMAIL` must be that address until a domain is verified in Resend and the From line is changed.

## Standing rule

Any PR that changes architecture (new secret, cron, storage, binding, or deploy change) must update this file in the same PR.
