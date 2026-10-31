# Wetility MarTech Programme

Implementation guide, tracking registry and vendor knowledge base for Wetility's MarTech, ad-asset ownership and full-funnel conversion programme. Runs on Railway with a Postgres database.

## What it does

- **Playbooks 4.1 to 4.13**: step statuses, acceptance tests, implementation log with evidence links, problems-and-fixes log, comments.
- **Tracking registry**: every canonical event, identifier and parameter, and every place it is implemented (dataLayer, GTM tags/triggers/variables, GA4, Firebase, Branch.io, Amplitude, Freshsales, Zuper, respond.io, ledger, Google Ads, Meta, TikTok), in data-flow order.
- **Consistency check**: privacy conflicts, duplicate implementations, name collisions, near-duplicate fields, names that differ from the canonical name, renames in progress, gaps. Align, rename, mark platform-required, or merge from the UI. Every change is recorded in the activity log.
- **Knowledge base**: current vendor guidance per platform with sources and a verified date; articles older than 90 days are flagged for review. Editors update articles in the app.
- **Results**: integrity and business KPIs with history against target.
- **CSV exports**: registry, implementation log and issues.

## Where things live

| What | Where | How to change it |
| --- | --- | --- |
| Playbook steps, gates, QA tests, KPI definitions | `public/content.js` | Edit and push to `main`; Railway redeploys |
| Statuses, logs, issues, results, comments | Postgres | In the app |
| Knowledge base, registry fields and implementations | Postgres (seeded once from `src/seed.js`) | In the app |
| Users and roles | Postgres | Admin > People and access |

Step statuses are keyed by playbook and step number (`pb42-s3`). If you insert a step in the middle of a playbook in `content.js`, statuses of the later steps shift; add new steps at the end instead.

## Environment variables (Railway)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Reference to the Railway Postgres service |
| `SESSION_SECRET` | Long random string for signing sessions |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | First admin, created on first boot only. Must change the password at first sign-in. |

## Roles

- **Admin**: everything, plus adding people, resetting passwords and roles.
- **Editor**: update statuses, registry, knowledge base, logs, issues, results.
- **Viewer**: read only.

## Run locally

```bash
npm install
DATABASE_URL=postgres://user@localhost:5432/martech SESSION_SECRET=dev ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=change-me-now npm start
```
