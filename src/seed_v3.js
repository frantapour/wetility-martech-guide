// v3: export guides per platform and native-integration recommendations (researched 31 Oct 2026).
// Applied once. Existing articles are only updated if nobody has edited them in the app yet.
const { q, pool } = require("./db");
const D = "2026-10-31";
const V = "Claude research";
const A = (id, title, system, pbs, summary, steps, practices, changes, sources, verified = true) =>
  ({ id, title, system, pbs, summary, steps, practices, changes, sources, verified_on: verified ? D : null, verified_by: verified ? V : null });

const EXPORTS = [
  A("export-freshsales", "Export current setup: Freshsales", "freshsales", ["pb41", "pb46"],
    "Two ways to get Freshsales fields into the registry. The API route gives the real internal field names (cf_...), which is what integrations use; the copy-paste route is quicker but only gives display labels. Record data exports (Admin Settings > Account > Export data) export records, not field definitions.",
    ["Best: ask Josh to call GET /api/settings/contacts/fields?include=field_group (and the same for deals and sales_accounts) with an admin API key. Save each response as a .json file.",
     "On the Import page choose System = Freshsales CRM, format 'Freshsales fields API (JSON)', Container = Contacts (then Deals, Accounts), and upload the file. Names come in as the real API keys; labels and groups come along.",
     "Quick alternative: Admin Settings > Module customisation > Contacts > Fields. Select the whole layout, copy, and paste it on the Import page with format 'Copied list'.",
     "Also record workflows that call webhooks and the connected integrations (Admin Settings > Integrations, including Integrate Social Media with CRM: accounts, ad accounts, pages, forms) as type 'workflow' or 'integration'.",
     "Re-import whenever fields are added or removed. Items missing from a re-import are offered for deprecation."],
    ["Record who connected each integration and with which account; anything connected by a former agency or a personal email is an ownership risk."],
    [], [
      { title: "Freshworks CRM API: settings and fields endpoints", url: "https://developers.freshworks.com/crm/api" },
      { title: "Freshsales: How do I export all required data from the CRM", url: "https://support.freshsales.io/support/solutions/articles/50000001894-how-do-i-export-all-required-data-from-the-crm-" }]),
  A("export-gtm", "Export current setup: Google Tag Manager", "gtm", ["pb41", "pb47"],
    "GTM exports a full container as JSON: every tag, trigger and variable, with what each tag fires on. The Import page reads this file directly.",
    ["Admin > Export container.", "Choose the latest published version (not a workspace) so you record what is live.", "Export, then on the Import page choose System = Google Tag Manager, format 'GTM container export (JSON)' and upload the file. The container ID is filled in automatically.",
     "Repeat for every container on the site and app, including any created by agencies; containers you cannot export are an ownership finding for playbook 4.1."],
    ["Keep each export file with the date; it is also your rollback point before changes."], [],
    [{ title: "Google: Tag Manager data layer and container docs", url: "https://developers.google.com/tag-platform/tag-manager/datalayer" }], false),
  A("export-ga4", "Export current setup: GA4", "ga4", ["pb41", "pb49"],
    "GA4 has no one-click settings export. Copy the event names and custom definitions from Admin, or have Josh pull them with the Analytics Admin API.",
    ["Admin > Data display > Events: copy the event names (one per line) and import with type 'event'. Mark key events by importing them again with type 'key event'.",
     "Admin > Data display > Custom definitions: copy custom dimensions and metrics; import with type 'custom dimension' or 'event parameter'.",
     "Admin > Product links: record Google Ads, BigQuery and Firebase links as type 'integration'.",
     "Record the property ID and each data stream's measurement ID in Container."],
    [], [], [{ title: "Google: Measurement Protocol reference", url: "https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference" }], false),
  A("export-firebase", "Export current setup: Firebase (app analytics)", "firebase", ["pb413"],
    "App events live in the GA4 property linked to the Firebase project. Copy the event names for the app stream.",
    ["Firebase console > Analytics > Events, or GA4 Admin > Events filtered to the app stream: copy event names.", "Import with System = Firebase, type 'event' (or 'automatic event' for first_open, app_open and similar).", "Record firebase_app_id and the GA4 app stream ID in Container."],
    [], [], [{ title: "Firebase: Google Analytics for Firebase", url: "https://firebase.google.com/docs/analytics" }], false),
  A("export-amplitude", "Export current setup: Amplitude", "amplitude", ["pb49"],
    "Amplitude Data lists every event and property in the tracking plan; export it as CSV and import with the CSV format.",
    ["Amplitude Data > Events: export the event list as CSV (columns include the event name and description).", "On the Import page choose System = Amplitude, format 'CSV with a header row'.", "Repeat for event properties and user properties with the matching type.", "Record cohort syncs to ad platforms (Destinations) as type 'integration'."],
    [], [], [{ title: "Amplitude: HTTP V2 API", url: "https://amplitude.com/docs/apis/analytics/http-v2" }], false),
  A("export-branch", "Export current setup: Branch.io", "branch", ["pb413"],
    "Record the Branch events in use and every ad partner enabled in Partner Management, with its postbacks.",
    ["Partner Management: list each enabled ad partner (Google Ads, Meta, TikTok and others). Import each as type 'integration'.", "For each partner, open Postback Config and record which events are sent. INSTALL and PURCHASE postbacks switch on automatically when a partner is enabled.", "Record custom events and link data keys you use (for example ~referring_link) with type 'custom event' or 'link data'."],
    ["Check the account each partner is connected with; it must be Wetility-owned."], [],
    [{ title: "Branch: Basic postback configuration", url: "https://help.branch.io/using-branch/docs/configuring-post-backs" }]),
  A("export-respond", "Export current setup: respond.io", "respond", ["pb48"],
    "Copy contact fields, webhooks and the workflow steps that send data out (HTTP requests, Conversions API events).",
    ["Workspace Settings > Contact fields: copy the list and import with type 'contact field'.", "Workspace Settings > Integrations > Webhooks: record each endpoint and its events as type 'webhook event'.", "Workflows: record every 'Send Conversions API Event' and 'HTTP Request' step as type 'workflow step', with what it sends in the description."],
    [], [], [{ title: "respond.io: Send Conversions API Event step", url: "https://respond.io/help/workflows/step-send-conversions-api-event" }]),
  A("export-zuper", "Export current setup: Zuper", "zuper", ["pb46"],
    "Copy job and customer custom fields, job statuses and webhooks.",
    ["Settings > Custom fields (Jobs, Customers): copy and import with type 'field'.", "Settings > Jobs > statuses: import each status as type 'job status', mapping commissioning to commissioning_completed.", "Settings > Developer Hub > Webhooks: record each webhook (module, event, URL) as type 'webhook event'."],
    [], [], [{ title: "Zuper docs: Webhooks", url: "https://docs.zuper.co/Settings/Developer_Hub/Webhooks" }]),
  A("export-meta", "Export current setup: Meta", "meta", ["pb42"],
    "Record the dataset (pixel), the events it receives and every connected partner, from the Wetility Business Portfolio.",
    ["Events Manager > your dataset > Overview: copy the event names and import with type 'standard event' or 'custom event'.", "Events Manager > Settings: record Conversions API integrations and partner integrations (respond.io, Freshsales lead forms) as type 'integration'.", "Business Settings: record ad accounts, datasets, pages, WhatsApp accounts and partners in the asset register (playbook 4.1)."],
    [], [], [{ title: "Meta: Conversions API documentation", url: "https://developers.facebook.com/docs/marketing-api/conversions-api" }], false),
  A("export-tiktok", "Export current setup: TikTok", "tiktok", ["pb43"],
    "Record the pixel events and CRM events from Events Manager, and the lead-form connection to Freshsales.",
    ["Events Manager > your pixel > Events: copy event names; import with type 'standard event'.", "Events Manager > CRM events (if set up): import with type 'CRM event'.", "Record how TikTok lead-form leads reach Freshsales (there is no native connector; usually Zapier or LeadsBridge) as type 'integration'."],
    [], [], [{ title: "TikTok: Signal postback for lead quality optimization", url: "https://ads.tiktok.com/help/article/about-signal-postback-for-lead-quality-optimization?lang=en" }]),
  A("export-gads", "Export current setup: Google Ads", "gads", ["pb44", "pb410"],
    "Copy conversion actions and record which are primary for bidding, plus every data source connected in Data Manager.",
    ["Goals > Conversions > Summary: copy or download the conversion actions; import with type 'conversion action'. Note primary or secondary in the description.", "Tools > Data manager: record connected sources (GA4 link, Customer Match, offline imports) as type 'integration'.", "Admin > Access and security: record manager accounts for the asset register."],
    [], [], [{ title: "Google Ads Data Manager: supported data sources", url: "https://support.google.com/google-ads-data-manager/table/13860693" }])
];

const NATIVE = [
  A("native-overview", "Native integrations: what to use between Wetility platforms", "native", ["pb410", "pb46", "pb48", "pb413"],
    "Which built-in connections exist between the platforms Wetility already pays for, and where the custom ingestion service and ledger are still needed. Rule of thumb: use native connectors for audiences, app attribution and early-funnel events; use the ledger for anything that must be deduplicated, reconciled with Zuper, or kept away from credit data.",
    ["USE: Branch.io to Google Ads, Meta and TikTok (partner postbacks) for app installs and in-app purchases.",
     "USE: GA4 to Google Ads link for website key events and audiences; Firebase to GA4 for app analytics.",
     "USE: respond.io 'Send Conversions API Event' step for WhatsApp leads from click-to-WhatsApp ads, within 7 days of the click.",
     "USE: Freshsales social integration for Meta Instant Form leads, reconnected under a Wetility-owned account; then send stage updates back with Meta Conversion Leads (Meta Lead ID is already a Freshsales field).",
     "USE: Google Ads Data Manager pulling offline conversions from the ledger database (PostgreSQL, BigQuery, Sheets, SFTP or HTTPS are supported sources). Freshsales itself is not a supported source.",
     "USE WITH CARE: Amplitude cohort sync to Google Ads, Meta and TikTok (hourly or daily) for audiences such as exclusions of existing customers. Check the legal basis first.",
     "NOT NATIVE: Zuper to Freshsales (Zuper's native CRM list is HubSpot, Zoho CRM, Freshdesk, Zendesk, Sprinklr). Keep webhooks into the ingestion service.",
     "NOT NATIVE: respond.io to Freshsales (native CRMs are HubSpot and Salesforce). Use webhooks or the Workflow HTTP Request step; Zapier only as a stopgap.",
     "NOT NATIVE: TikTok lead forms to Freshsales. Currently via a third party (Zapier, LeadsBridge or similar); confirm which and who owns it."],
    ["One owner per signal: if Branch sends app installs to Meta, the ledger must not send them too.", "Every native connection is an asset: record who connected it and with which account in the registry (type 'integration')."],
    ["Changes playbook 4.10: offline conversions to Google can use Data Manager's database connector instead of custom upload code.", "Changes the Meta CRM article: Wetility appears to run Meta Instant Forms (Meta Lead ID field, Freshsales lead-form connection), so Conversion Leads applies to those leads."],
    [{ title: "Google Ads Data Manager: supported data sources", url: "https://support.google.com/google-ads-data-manager/table/13860693" },
     { title: "Zuper: CRM integrations", url: "https://care.zuper.co/portal/en/kb/integrations/c-r-m" },
     { title: "respond.io: Integrations without a technical team", url: "https://respond.io/faqs/can-we-set-up-integrations-without-a-technical-team" },
     { title: "Amplitude: Sync cohorts with destinations", url: "https://amplitude.com/docs/data/sync-cohorts-with-destinations" },
     { title: "Branch: Basic postback configuration", url: "https://help.branch.io/using-branch/docs/configuring-post-backs" }]),
  A("native-gads-data-manager", "Native: ledger to Google Ads through Data Manager", "native", ["pb410"],
    "Google Ads Data Manager can connect to a PostgreSQL or BigQuery database, Google Sheets, SFTP or an HTTPS endpoint and import offline conversions on a schedule. Pointing it at a read-only view of the event ledger avoids building a custom upload to the Data Manager API.",
    ["Create a read-only database view of eligible conversions: gclid (or hashed email/phone where permitted), conversion action name, conversion time with timezone, value, order ID = ledger event_id.", "Google Ads > Tools > Data manager > Connect a product > PostgreSQL (or BigQuery). Use a dedicated read-only database user.", "Map columns to the conversion action and schedule the import (daily to start).", "Check import diagnostics and match rates; keep the actions secondary until proven."],
    ["Never include credit fields in the view."], [], [{ title: "Google Ads Data Manager: supported data sources", url: "https://support.google.com/google-ads-data-manager/table/13860693" }, { title: "Google Ads: About Data manager", url: "https://support.google.com/google-ads/answer/14639041" }]),
  A("native-meta-leadforms", "Native: Meta Instant Forms to Freshsales, and stages back to Meta", "native", ["pb42", "pb410"],
    "Freshsales' social media integration imports Meta lead-form leads (it is connected today, through a former agency person's personal account). Because those leads carry a Meta Lead ID, Wetility can send CRM stage changes back with Meta's Conversion Leads integration so Meta optimises for leads that progress.",
    ["Reconnect Freshsales > Integrate Social Media with CRM from a Wetility-owned Meta account with two admins; re-select pages and forms.", "Confirm the Meta Lead ID field is filled for every Instant Form lead.", "Send each stage change for those leads to the Wetility dataset: action_source = system_generated, custom_data.event_source = crm, custom_data.lead_event_source = Freshsales, lead_id, event_time within 7 days.", "Send all stages in order, starting with the initial lead stage."],
    ["Stage names must not reveal credit outcomes unless the Information Officer approves."], [], [{ title: "Meta: Conversion Leads payload specification", url: "https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/payload-specification" }]),
  A("native-branch-partners", "Native: Branch.io postbacks to Google Ads, Meta and TikTok", "native", ["pb413"],
    "Enabling an ad partner in Branch automatically turns on INSTALL and PURCHASE postbacks to that partner; other events can be added per partner. Branch disables postbacks that only return errors for 7 days.",
    ["Partner Management: enable Google Ads, Meta and TikTok using Wetility-owned ad accounts.", "Postback Config: add the in-app events that matter (for example meter_linked, topup_completed) using canonical names.", "Do not enable 'All Events' unless needed; it sends events regardless of attribution.", "Record each partner as an 'integration' item in the registry under Branch.io."],
    [], [], [{ title: "Branch: Basic postback configuration", url: "https://help.branch.io/using-branch/docs/configuring-post-backs" }]),
  A("native-amplitude-cohorts", "Native: Amplitude cohorts to Google Ads, Meta and TikTok", "native", ["pb49"],
    "Amplitude can sync cohorts to Google Ads, Facebook Ads and TikTok Ads once or on an hourly or daily schedule (not real-time for these destinations). Useful for excluding existing customers and for audiences of high-intent prospects who did not convert.",
    ["Amplitude > Destinations: connect each ad platform using a Wetility-owned account.", "Create cohorts from canonical events (for example commissioning_completed for exclusions).", "Choose a daily schedule.", "Get Information Officer approval for the cohort definitions before syncing."],
    ["Never build cohorts from credit fields."], [], [{ title: "Amplitude: Sync cohorts with destinations", url: "https://amplitude.com/docs/data/sync-cohorts-with-destinations" }]),
  A("native-not-available", "No native connector: Zuper, respond.io and TikTok lead forms to Freshsales", "native", ["pb46", "pb48"],
    "Three connections Wetility needs have no built-in connector, so they go through the ingestion service (webhooks) or a third-party tool.",
    ["Zuper to Freshsales: Zuper's native CRM integrations are HubSpot, Zoho CRM, Freshdesk, Zendesk and Sprinklr. Use Zuper webhooks into the ingestion service (playbook 4.6).", "respond.io to Freshsales: native CRMs are HubSpot and Salesforce. Use respond.io webhooks or a Workflow HTTP Request step calling the ingestion service.", "TikTok lead forms to Freshsales: no native connector; Zapier, LeadsBridge and others offer it. Record which one is used, who owns the account, and whether TikTok Lead ID is passed."],
    ["Third-party connectors are assets: owned by a Wetility account, recorded in the registry, and on the offboarding checklist."], [],
    [{ title: "Zuper: CRM integrations", url: "https://care.zuper.co/portal/en/kb/integrations/c-r-m" }, { title: "respond.io: Integrations without a technical team", url: "https://respond.io/faqs/can-we-set-up-integrations-without-a-technical-team" }])
];

async function seedV3() {
  const done = await q("SELECT value FROM meta WHERE key='seeded_v3'");
  if (done.rowCount) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const k of [...EXPORTS, ...NATIVE]) {
      await client.query(`INSERT INTO kb (id,title,system,pbs,summary,steps,practices,changes,sources,verified_on,verified_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
        [k.id, k.title, k.system, JSON.stringify(k.pbs), k.summary, JSON.stringify(k.steps), JSON.stringify(k.practices), JSON.stringify(k.changes), JSON.stringify(k.sources), k.verified_on, k.verified_by]);
    }
    // Correct the Meta CRM article if nobody has edited it yet.
    await client.query(`UPDATE kb SET summary=$1, changes=$2, verified_on=$3, verified_by=$4 WHERE id='meta-crm-leads' AND updated_by IS NULL`, [
      "Meta's Conversion Leads integration (CRM stages sent back through Conversions API with action_source = system_generated) supports only native Lead Ads (Instant Forms). Wetility's Freshsales has a Meta Lead ID field and a native Meta lead-form connection, so it applies to those leads; website and WhatsApp leads need the other routes.",
      JSON.stringify(["Manual v1.1 step 4.10.3 mentions a 'CAPI/CRM connection'. Applies to Meta Instant Form leads only; see 'Native: Meta Instant Forms to Freshsales, and stages back to Meta'."]), D, V]);
    await client.query("INSERT INTO meta (key,value) VALUES ('seeded_v3',$1)", [new Date().toISOString()]);
    await client.query("COMMIT");
    console.log("Applied knowledge base update v3.");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
module.exports = { seedV3 };
