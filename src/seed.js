// Initial knowledge base and tracking registry. Runs once, when the database is first created.
// After that, the app is the source of truth: edit, verify and rename in the UI, not here.
const bcrypt = require("bcryptjs");
const { q, pool } = require("./db");

const TODAY = "2026-10-31";

const KB = [
  {
    id: "google-data-manager", title: "Google Ads offline conversions via Data Manager API", system: "gads", pbs: ["pb410", "pb44"],
    summary: "Data Manager API is now Google's primary route for importing offline conversions and enhanced conversions for leads. Since 15 June 2026, developer tokens without recent offline-import history can no longer start offline imports through the Google Ads API (ConversionUploadService.UploadClickConversions returns CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE).",
    steps: [
      "Confirm which path Wetility (or a former agency) uses today for offline imports: Google Ads API, Data Manager API, the Google Ads Data Manager UI, or a CRM connector. Record it in the registry under Google Ads.",
      "If an agency token was used, do not rely on its allowlisting: build the Wetility integration on Data Manager API from the start.",
      "Create one imported conversion action per canonical milestone (for example credit approved, contract signed, commissioned install). Name each with the canonical event so it lines up in the registry.",
      "Send GCLID where captured, plus hashed (SHA-256, normalised) email and phone as user-provided data where consent and the legal basis allow (enhanced conversions for leads).",
      "Keep new offline actions as secondary goals until volume and match rates are proven, then test as primary in a controlled experiment.",
      "Monitor import diagnostics daily for the first two weeks: match rate, rejected rows, late events."
    ],
    practices: [
      "One conversion action per business milestone; never reuse one action for two stages.",
      "Use the ledger event_id as the deduplication/order ID so retries cannot double count.",
      "Report platform-attributed installs separately from total installs; never sum across platforms."
    ],
    changes: [
      "Manual v1.1 step 4.10.2 already pointed to Data Manager API. Now confirmed as mandatory for new offline-import setups (cutoff 15 June 2026).",
      "Agency-built imports may stop working if the agency developer token is the one that was allowlisted."
    ],
    sources: [
      { title: "TechWyse: Google Ads API offline conversion import cutoff (May 2026)", url: "https://www.techwyse.com/news/platform-updates/google-ads-api-offline-conversion-import-cutoff" },
      { title: "PPC Land: Data Manager API v1.7", url: "https://ppc.land/google-data-manager-api-v1-7-finally-brings-gmp-into-the-signal-loop/" },
      { title: "Google Ads API: conversions overview", url: "https://developers.google.com/google-ads/api/docs/conversions/overview" }
    ],
    verified_on: TODAY, verified_by: "Claude research"
  },
  {
    id: "meta-ctwa", title: "Meta: WhatsApp (click-to-WhatsApp) conversions", system: "meta", pbs: ["pb48", "pb410", "pb42"],
    summary: "Conversions from WhatsApp chats go through Meta's Conversions API for Business Messaging, keyed on the ctwa_clid click ID from the ad. respond.io can send these natively with its 'Send Conversions API Event' workflow step, but only for chats that started from a click-to-WhatsApp ad, within 7 days of the click, and one event per ad click.",
    steps: [
      "In Meta Events Manager, create (or reuse) a Wetility-owned dataset and link it to the Wetility WhatsApp Business Account.",
      "In respond.io, confirm ctwa_clid is captured automatically for CTWA conversations (it arrives in the referral object of the inbound message).",
      "For early-funnel events inside 7 days (lead captured, qualified), use the respond.io workflow step 'Send Conversions API Event' (Lead Generated or Purchase).",
      "For anything else, send directly to the dataset: action_source = business_messaging, messaging_channel = whatsapp, user_data.whatsapp_business_account_id and user_data.ctwa_clid, plus event_name and event_time.",
      "Deduplicate in the ledger before sending: Meta does not deduplicate business-messaging events.",
      "Check events in Events Manager for the dataset; Meta needs about 50 signals before it optimises on them."
    ],
    practices: [
      "Store ctwa_clid against the conversation and contact at first message; it cannot be recovered later.",
      "Chats that did not start from an ad (QR code, website link, saved number) are not eligible. Attribute them through the website handoff token instead.",
      "Supported event names include LeadSubmitted, QualifiedLead and Purchase. Map canonical events to these in the registry."
    ],
    changes: [
      "Not covered in manual v1.1. Adds a separate attribution path for direct click-to-WhatsApp ads (step 4.8.8).",
      "7-day window: commissioning happens weeks after the click, so a commissioning signal for CTWA leads is likely not sendable to Meta through this route. Use credit approval (QualifiedLead) if it happens inside 7 days, and test."
    ],
    sources: [
      { title: "Meta: Conversions API for Business Messaging onboarding", url: "https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging" },
      { title: "respond.io: Workflow step Send Conversions API Event", url: "https://respond.io/help/workflows/step-send-conversions-api-event" }
    ],
    verified_on: TODAY, verified_by: "Claude research"
  },
  {
    id: "meta-crm-leads", title: "Meta: CRM conversion leads only apply to Meta Lead Ads", system: "meta", pbs: ["pb410"],
    summary: "Meta's Conversion Leads integration (CRM stages sent back through Conversions API with action_source = system_generated) currently supports only native Lead Ads (Instant Forms). Wetility leads from the website and WhatsApp are not eligible for that product.",
    steps: [
      "Check whether Wetility runs any Meta Instant Form campaigns. If not, skip the Conversion Leads integration.",
      "For website leads: send standard Conversions API web events from the server (action_source = website) with the same event_id as the browser pixel event for deduplication, plus fbp/fbc and hashed contact data where permitted.",
      "For WhatsApp leads: use the business-messaging route (see the WhatsApp article).",
      "If Instant Forms are used later: send every CRM stage as it happens (initial lead stage first), with lead_id (15 to 17 digits, from leadgen_id), event_time within 7 days, custom_data.event_source = crm and custom_data.lead_event_source = Freshsales."
    ],
    practices: [
      "Do not send credit-derived stage names or values without Information Officer approval.",
      "An invalid lead_id rejects the event; validate before sending."
    ],
    changes: [
      "Manual v1.1 step 4.10.3 mentions a 'CAPI/CRM connection'. Narrowed: the CRM product only works for Meta Lead Ads, so website and WhatsApp lead outcomes need the routes above."
    ],
    sources: [
      { title: "Meta: Conversion Leads payload specification", url: "https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/payload-specification" }
    ],
    verified_on: TODAY, verified_by: "Claude research"
  },
  {
    id: "meta-capi-web", title: "Meta: website pixel plus Conversions API deduplication", system: "meta", pbs: ["pb42", "pb47"],
    summary: "Send the same website event from the browser pixel and from the server, sharing one event_id, so Meta keeps one copy. Use the Wetility-owned dataset only.",
    steps: [
      "Generate event_id on the server when the lead is accepted; return it to the browser with the lead_id.",
      "Fire the pixel Lead event in GTM with eventID = event_id.",
      "Send the server event with event_name = Lead, action_source = website, event_id, event_time, event_source_url, fbp and fbc cookies, client IP and user agent, and hashed contact data only if permitted.",
      "Use Test Events in Events Manager to confirm 'Deduplicated' status and check Event Match Quality."
    ],
    practices: ["Never put raw phone, email, SA ID or credit data in the browser event."],
    changes: [],
    sources: [{ title: "Meta: Conversions API documentation", url: "https://developers.facebook.com/docs/marketing-api/conversions-api" }],
    verified_on: null, verified_by: null
  },
  {
    id: "tiktok-lqo", title: "TikTok: signal postback and lead quality optimisation", system: "tiktok", pbs: ["pb43", "pb410"],
    summary: "TikTok optimises toward better leads when lower-funnel CRM statuses are posted back through the Events API (or CSV/connectors). It recommends more than 50 signals within 14 days for stable optimisation.",
    steps: [
      "Use the Wetility-owned pixel/dataset in TikTok Events Manager.",
      "Choose the postback method: CRM Events API (recommended for Wetility's ledger), or CSV as a stopgap.",
      "Send CRM events with event_name = the CRM status, and event_time as an integer Unix timestamp in seconds (UTC) of when the status changed.",
      "Match with lead_id where the lead came from a TikTok form (best match rate); otherwise hashed email or phone, and ttclid where captured on the website.",
      "In Events Manager, map each CRM status to TikTok's funnel stages for deep funnel optimisation.",
      "Check volume: if a milestone gets fewer than about 50 signals in 14 days, optimise on an earlier stage."
    ],
    practices: ["Send statuses as they change, not in one month-end batch.", "Keep CRM status names identical to the canonical event names."],
    changes: ["Adds TikTok's volume threshold (about 50 signals in 14 days) to the bidding gate G5."],
    sources: [
      { title: "TikTok: About signal postback for lead quality optimization", url: "https://ads.tiktok.com/help/article/about-signal-postback-for-lead-quality-optimization?lang=en" },
      { title: "TikTok: CRM signal postback (manual sourcebook)", url: "https://ads.tiktok.com/resources/help/article/about-lead-quality-optimization-and-crm-signal-postback" }
    ],
    verified_on: TODAY, verified_by: "Claude research"
  },
  {
    id: "ga4-mp", title: "GA4 Measurement Protocol for server-side events", system: "ga4", pbs: ["pb49"],
    summary: "Measurement Protocol adds server events to GA4, but it only accepts events backdated up to 72 hours. Commissioning and other late milestones usually fall outside that window, so they belong in Amplitude and the ledger, not GA4.",
    steps: [
      "Use GA4 for website acquisition and browser behaviour; use Amplitude for the full funnel to commissioning.",
      "Only send server events to GA4 that happen within 72 hours of the web session (for example an accepted lead).",
      "Include the GA4 client_id captured at form submission; without it, events do not join the session.",
      "Pass consent.ad_user_data and consent.ad_personalization as GRANTED or DENIED from the visitor's consent state.",
      "Validate with validation_behavior = ENFORCE_RECOMMENDATIONS or the Event Builder before going live."
    ],
    practices: ["Event and parameter names: 40 characters or fewer; up to 25 parameters per event.", "Never send phone or email in parameters."],
    changes: ["Manual v1.1 step 4.9.3 did not mention the 72-hour backdating limit. Added."],
    sources: [{ title: "Google: Measurement Protocol reference", url: "https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference" }],
    verified_on: TODAY, verified_by: "Claude research"
  },
  {
    id: "gtm-server-side", title: "GTM: server-side tagging versus Google tag gateway", system: "gtm", pbs: ["pb47", "pb411"],
    summary: "Google tag gateway serves Google tags first-party through a CDN (for example Cloudflare) with little setup, but only for Google products. Server-side GTM handles Google, Meta and TikTok, and lets Wetility strip or transform data before it reaches vendors.",
    steps: [
      "Decide: with Meta and TikTok in scope and credit data to keep out, server-side GTM is the better fit. Tag gateway is a quick win only if server-side is not resourced.",
      "If server-side: host the server container on a Wetility subdomain (same first-party context), owned by a Wetility Google account.",
      "Route GA4, Meta CAPI and TikTok Events API through it; add a transformation that blocks any field marked sensitive in the registry.",
      "Keep the web container (current: GTM-N9XFQZMK, confirm) as the single source of dataLayer events."
    ],
    practices: ["One web container, one server container. Do not let agencies run their own containers on the site."],
    changes: ["New option not in manual v1.1. Decision needed before workstream 4."],
    sources: [{ title: "Louder: Google tag gateway vs server-side GTM", url: "https://louder.com.au/2025/07/14/google-tag-gateway-v-ssgtm/" }],
    verified_on: TODAY, verified_by: "Claude research"
  },
  {
    id: "zuper-webhooks", title: "Zuper: webhooks for job and commissioning changes", system: "zuper", pbs: ["pb46"],
    summary: "Zuper webhooks are created under Settings, Developer Hub, Webhooks. Zuper generates a secret key on creation and deactivates webhooks that keep failing, so the ingestion endpoint needs monitoring.",
    steps: [
      "Go to Settings > Developer Hub > Webhooks > + New Webhook.",
      "Give a unique name, choose the Jobs module and the status-change event, method POST, and the Wetility ingestion URL.",
      "Save, then store the generated secret key in the company vault and verify signatures on receipt (see Zuper's Webhook Signing Policy).",
      "Check Webhook History after each test.",
      "Alert on failures: Zuper deactivates a webhook after 100+ attempts in 24 hours all failing, or failures on each of the last 10 days. Reactivate from the edit screen."
    ],
    practices: ["Acknowledge fast, queue, then fetch the job from the API before writing the ledger event."],
    changes: ["Confirms the menu path in manual step 4.6.7 and adds the auto-deactivation rule."],
    sources: [{ title: "Zuper docs: Webhooks", url: "https://docs.zuper.co/Settings/Developer_Hub/Webhooks" }],
    verified_on: TODAY, verified_by: "Claude research"
  },
  {
    id: "respondio-webhooks", title: "respond.io: webhooks into the ingestion service", system: "respond", pbs: ["pb48"],
    summary: "respond.io webhooks send new messages, contacts and conversation changes to an HTTPS endpoint. Plan access and the signing method should be checked in the workspace before build.",
    steps: [
      "Workspace Settings > Integrations > Webhooks: add the HTTPS endpoint.",
      "Enable only the events needed: new incoming message, new contact, contact updated, conversation opened/closed.",
      "Verify the request signature, acknowledge quickly, and process from a queue.",
      "Store contact and conversation IDs, source/referral metadata (including ctwa_clid) and structured intent facts; keep transcripts out of analytics."
    ],
    practices: [],
    changes: [],
    sources: [{ title: "respond.io: Webhooks", url: "https://respond.io/help/integrations/webhooks" }],
    verified_on: null, verified_by: null
  },
  {
    id: "amplitude-http", title: "Amplitude: server-side events with HTTP V2", system: "amplitude", pbs: ["pb49"],
    summary: "Send canonical ledger events to Amplitude with a stable user_id and a unique insert_id per event so retries are dropped as duplicates.",
    steps: [
      "Use insert_id = ledger event_id.",
      "Decide the user_id: today the Ivy closed loop uses the normalised phone number (see the identifier decision). Move to a pseudonymous ID if the decision says so.",
      "Send event time as the business time of the milestone, not the send time.",
      "Check volumes against the ledger daily for two weeks."
    ],
    practices: ["Do not send raw phone or email as event properties."],
    changes: [],
    sources: [{ title: "Amplitude: HTTP V2 API", url: "https://amplitude.com/docs/apis/analytics/http-v2" }],
    verified_on: null, verified_by: null
  },
  {
    id: "popia-marketing", title: "POPIA: direct marketing and consent", system: "governance", pbs: ["pb45", "pb48"],
    summary: "The Information Regulator's guidance note says electronic direct marketing (which includes calls, SMS, email and cookie-based marketing) generally needs opt-in consent unless the existing-customer exception applies. Messages must identify the sender and give a way to opt out, and opt-outs must be kept on record.",
    steps: [
      "Record consent state and source with every lead (consent_ref in the registry).",
      "Keep a suppression list of people who withheld consent and check it before outbound WhatsApp or calls.",
      "Ask the Information Officer to confirm the legal basis for sending any hashed contact data to ad platforms.",
      "Treat credit-derived flags (like the 620+ threshold) as sensitive: no ad-platform use without explicit approval."
    ],
    practices: [],
    changes: ["WhatsApp is not named in the guidance note; ask the Information Officer how Wetility classifies it."],
    sources: [{ title: "DLA Piper Africa: Guidance Note on Direct Marketing", url: "https://www.dlapiperafrica.com/en/south-africa/insights/2025/Data-Protection-Guidance-Note-on-Direct-Marketing" }],
    verified_on: TODAY, verified_by: "Claude research"
  },
  {
    id: "app-branch-firebase", title: "Wetility App: Branch.io attribution and Firebase analytics", system: "branch", pbs: ["pb45", "pb49", "pb410"],
    summary: "The Wetility App adds a third entry path next to the website and WhatsApp. Branch.io attributes installs and deferred deep links to the ad or link that drove them; Firebase (GA4 app stream) records in-app behaviour. Both must use the same canonical event names as the website so app and web funnels can be compared.",
    steps: [
      "Record the Branch app key, Branch link domain, Firebase project ID, GA4 app stream ID and firebase_app_id in the registry under Branch.io and Firebase.",
      "Confirm Branch integrations with Google Ads, Meta and TikTok are connected to the Wetility-owned ad accounts (same ownership audit as playbook 4.1), not to a former agency.",
      "Map Branch standard events (INSTALL, OPEN and any custom events) and Firebase automatic events (first_open, app_open) to canonical events in the registry. Only add a new Firebase event name when no canonical event exists.",
      "Pass the Branch referring link or campaign into the app session and onto the lead, so an app-originated lead carries its acquisition source into Freshsales and the ledger.",
      "For server events sent to the GA4 app stream through Measurement Protocol, use firebase_app_id and app_instance_id (not a web client_id); the 72-hour backdating limit applies.",
      "Avoid double counting installs: if Branch forwards installs to ad platforms, do not also send the same install from Firebase or the ledger."
    ],
    practices: [
      "One owner for each ad-network connection: either Branch forwards app events, or the ledger outbox does. Never both.",
      "Use the same event_id across Branch, Firebase and the ledger for the same in-app occurrence."
    ],
    changes: [
      "Not covered in manual v1.1. Adds the app as a source system in the data flow and registry.",
      "Mobile deferred deep-linking setup was already underway in Project Ivy (Meta SAN configuration); confirm its status."
    ],
    sources: [
      { title: "Google: Measurement Protocol reference (app streams)", url: "https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference" },
      { title: "Branch help centre", url: "https://help.branch.io/" },
      { title: "Firebase: Google Analytics for Firebase", url: "https://firebase.google.com/docs/analytics" }
    ],
    verified_on: null, verified_by: null
  },
  {
    id: "freshsales-workflows", title: "Freshsales: workflows for deal and contract changes", system: "freshsales", pbs: ["pb46"],
    summary: "Freshsales workflows can fire on deal stage changes and call a webhook where the plan allows. Use them to tell the ingestion service that a deal changed, then fetch the deal by API.",
    steps: [
      "Admin Settings > Manage Workflows: create one workflow per milestone stage change.",
      "Action: trigger webhook to the ingestion endpoint with the deal ID only.",
      "Ingestion fetches the deal and writes the canonical event once."
    ],
    practices: ["Keep stage names in Freshsales identical to canonical event names where possible."],
    changes: [],
    sources: [{ title: "Freshsales: configure workflows", url: "https://support.freshsales.io/support/solutions/articles/228432-how-to-configure-workflow-" }],
    verified_on: null, verified_by: null
  }
];

// Canonical fields. expected = systems where this field should exist.
const F = (id, name, kind, description, measures, pii, owner, expected, aliases = []) => ({ id, name, kind, description, measures, pii, owner, expected, aliases });
const FIELDS = [
  F("lead_submitted", "lead_submitted", "event", "A web enquiry accepted by the backend and created in Freshsales. Not a button click.", "Count of genuine website leads", "none", "Josh", ["umbraco", "datalayer", "gtm", "ga4", "amplitude", "ledger", "meta", "tiktok", "gads"], ["web_lead_submitted"]),
  F("whatsapp_clicked", "whatsapp_clicked", "event", "Visitor clicked a WhatsApp CTA on the website; a handoff token is created.", "Web-to-WhatsApp intent", "none", "Palota", ["datalayer", "gtm", "ga4", "amplitude"]),
  F("pricing_viewed", "pricing_viewed", "event", "Pricing section or page viewed.", "Pricing interest", "none", "Palota", ["datalayer", "gtm", "ga4"]),
  F("product_viewed", "product_viewed", "event", "A product (PACE range) page or card viewed.", "Product interest", "none", "Palota", ["datalayer", "gtm", "ga4"]),
  F("savings_estimate_viewed", "savings_estimate_viewed", "event", "Savings estimate shown to the visitor.", "Engagement with savings calculator", "none", "Palota", ["datalayer", "gtm", "ga4"]),
  F("chat_started", "chat_started", "event", "First customer message received in a WhatsApp conversation.", "Conversation starts", "none", "Josh", ["respond", "ingest", "ledger", "amplitude"]),
  F("high_intent_reached", "high_intent_reached", "event", "Intent score crossed the threshold for the first time in a scoring version.", "Qualified intent before SA ID is collected", "none", "Beryl", ["ledger", "amplitude", "freshsales"]),
  F("contact_captured", "contact_captured", "event", "Prospect became contactable (phone or email captured). Not credit-qualified.", "Contactable leads", "none", "Josh", ["respond", "umbraco", "ledger", "amplitude"]),
  F("credit_assessed", "credit_assessed", "event", "Credit assessment completed. Result stays internal.", "Assessments run", "sensitive", "Josh", ["credit", "ledger"]),
  F("credit_qualified", "credit_qualified", "event", "Internal flag: score at or above 595. External use needs Information Officer approval.", "Sales-qualified leads (SQL)", "sensitive", "Josh", ["credit", "ledger"]),
  F("contract_signed", "contract_signed", "event", "Valid executed contract.", "Signed deals", "none", "Josh", ["freshsales", "ledger", "amplitude", "gads", "tiktok"]),
  F("credit_approved", "credit_approved", "event", "Formal credit approval recorded.", "Credit approvals", "none", "Josh", ["credit", "freshsales", "ledger", "amplitude", "gads", "tiktok", "meta"]),
  F("installation_completed", "installation_completed", "event", "Installation work finished. Commissioning is separate.", "Installs completed", "none", "Beryl", ["zuper", "ledger", "amplitude"]),
  F("commissioning_completed", "commissioning_completed", "event", "Validated system commissioning; the commercial outcome Wetility optimises for.", "Commissioned installations (revenue trigger after Finance validation)", "none", "Beryl", ["zuper", "ingest", "ledger", "amplitude", "gads", "tiktok"]),
  F("revenue_recognised", "revenue_recognised", "event", "Revenue recognised in the accounting source.", "Recognised revenue", "none", "Finance", ["ledger"]),
  F("event_id", "event_id", "identifier", "Unique ID of one occurrence; shared by browser and server copies for deduplication.", "Deduplication key", "none", "Josh", ["datalayer", "gtm", "ledger", "meta", "tiktok", "amplitude"], ["submission_event_id", "insert_id"]),
  F("lead_id", "lead_id", "identifier", "Opaque Wetility lead ID returned to the browser after a lead is accepted.", "Join from web event to CRM lead", "pseudonymous", "Josh", ["umbraco", "datalayer", "freshsales", "ledger"]),
  F("visitor_id", "visitor_id", "identifier", "Anonymous website visitor ID.", "Web identity", "pseudonymous", "Josh", ["datalayer", "ledger"]),
  F("ga_client_id", "ga_client_id", "identifier", "GA4 client_id captured at form submission so server events join the session.", "GA4 session join", "pseudonymous", "Josh", ["umbraco", "ledger", "ga4"]),
  F("conversation_id", "conversation_id", "identifier", "respond.io conversation ID.", "Chat join", "pseudonymous", "Josh", ["respond", "ledger", "freshsales"]),
  F("respond_contact_id", "respond_contact_id", "identifier", "respond.io contact ID.", "Chat contact join", "pseudonymous", "Josh", ["respond", "ledger"]),
  F("freshsales_deal_id", "freshsales_deal_id", "identifier", "Freshsales deal ID.", "CRM join", "pseudonymous", "Josh", ["freshsales", "ledger"]),
  F("contract_id", "contract_id", "identifier", "Wetility contract ID; the canonical join key across CRM, ledger and Zuper (proposed, see identifier decision).", "Contract-level join", "pseudonymous", "Josh", ["freshsales", "zuper", "ledger"], ["contract_number"]),
  F("zuper_job_id", "zuper_job_id", "identifier", "Zuper job ID.", "Field ops join", "pseudonymous", "Beryl", ["zuper", "ledger"]),
  F("phone_e164", "phone_e164", "identifier", "Phone normalised to +27XXXXXXXXX. Current primary key of the Ivy closed loop.", "Person-level join (current)", "personal", "Beryl", ["freshsales", "respond", "ledger"], ["phone", "mobile"]),
  F("gclid", "gclid", "identifier", "Google Ads click ID from the landing URL; first touch kept, never overwritten.", "Google attribution", "pseudonymous", "Josh", ["umbraco", "ledger", "gads"]),
  F("fbc", "fbc", "identifier", "Meta click ID cookie (from fbclid).", "Meta web attribution", "pseudonymous", "Josh", ["umbraco", "ledger", "meta"], ["fbclid"]),
  F("ttclid", "ttclid", "identifier", "TikTok click ID from the landing URL.", "TikTok web attribution", "pseudonymous", "Josh", ["umbraco", "ledger", "tiktok"]),
  F("ctwa_clid", "ctwa_clid", "identifier", "Click-to-WhatsApp ad click ID from the inbound message referral.", "Meta WhatsApp attribution (7-day window)", "pseudonymous", "Josh", ["respond", "ledger", "meta"]),
  F("product_interest", "product_interest", "parameter", "Product the lead asked about (for example PACE_MAXI).", "Product mix of demand", "none", "Reeza", ["datalayer", "gtm", "ga4", "freshsales", "amplitude"]),
  F("lead_channel", "lead_channel", "parameter", "Where the lead came in: website, whatsapp, field, broker.", "Channel mix", "none", "Reeza", ["datalayer", "ga4", "freshsales", "ledger", "amplitude"]),
  F("form_type", "form_type", "parameter", "Which form produced the lead.", "Form performance", "none", "Palota", ["datalayer", "ga4"]),
  F("consent_status", "consent_status", "parameter", "Visitor's consent state for analytics and ads at the time of the event.", "Lawful basis for downstream use", "none", "Josh", ["datalayer", "gtm", "ledger", "ga4"]),
  F("utm_source", "utm_source", "parameter", "Campaign source from the landing URL.", "Source attribution", "none", "Reeza", ["umbraco", "freshsales", "ledger", "ga4"]),
  F("utm_campaign", "utm_campaign", "parameter", "Campaign name from the landing URL.", "Campaign attribution", "none", "Reeza", ["umbraco", "freshsales", "ledger", "ga4"]),
  F("intent_score", "intent_score", "attribute", "Chatbot intent score with tier and scoring version.", "Predictive intent", "none", "Beryl", ["ledger", "freshsales", "amplitude"]),
  F("app_install", "app_install", "event", "First open of the Wetility App after install, attributed by Branch.io.", "App installs by source", "none", "Josh", ["branch", "firebase", "ledger", "amplitude"]),
  F("app_open", "app_open", "event", "Wetility App opened (including via a Branch deep link).", "App engagement", "none", "Josh", ["branch", "firebase"]),
  F("meter_linked", "meter_linked", "event", "One Bill customer linked a meter in the app.", "One Bill activation", "none", "Beryl", ["app", "firebase", "ledger", "amplitude"]),
  F("topup_completed", "topup_completed", "event", "One Bill prepaid top-up completed in the app.", "One Bill usage and revenue", "none", "Beryl", ["app", "firebase", "ledger", "amplitude"]),
  F("app_instance_id", "app_instance_id", "identifier", "Firebase app instance ID; needed to send server events to the GA4 app stream.", "App session join", "pseudonymous", "Josh", ["firebase", "ledger"]),
  F("branch_referring_link", "branch_referring_link", "identifier", "Branch link or campaign that drove the install or open.", "App attribution", "pseudonymous", "Josh", ["branch", "app", "ledger", "freshsales"], ["~referring_link"]),
  F("credit_score", "credit_score", "attribute", "Bureau credit score. Internal only; must never reach GTM, GA4, Amplitude or ad platforms.", "Credit risk", "sensitive", "Josh", ["credit", "freshsales"])
];

// Implementations as designed in manual v1.1 plus known current reality. state: planned | live | rename-pending | deprecated
const I = (field_id, system, kind, name, o = {}) => ({ field_id, system, kind, name, container: o.container || "", label: o.label || "", parent: o.parent || "", std: !!o.std, state: o.state || "planned", description: o.d || "" });
const GTM = "GTM-N9XFQZMK";
const IMPLS = [
  I("lead_submitted", "umbraco", "endpoint response", "lead_submitted", { d: "Backend returns lead_id and event_id after Freshsales accepts the lead." }),
  I("lead_submitted", "datalayer", "dataLayer event", "lead_submitted", { d: "Pushed only after a successful backend response." }),
  I("lead_submitted", "gtm", "trigger", "lead_submitted", { container: GTM, label: "CE - lead_submitted", d: "Custom Event trigger." }),
  I("lead_submitted", "gtm", "tag", "generate_lead", { container: GTM, label: "GA4 Event - generate_lead", parent: "CE - lead_submitted", std: true, d: "Sends GA4 recommended event generate_lead." }),
  I("lead_submitted", "gtm", "tag", "Lead", { container: GTM, label: "Meta Pixel - Lead", parent: "CE - lead_submitted", std: true, d: "Meta standard event with eventID = event_id." }),
  I("lead_submitted", "ga4", "key event", "generate_lead", { std: true, d: "GA4 recommended lead event, marked as key event." }),
  I("lead_submitted", "meta", "standard event", "Lead", { std: true, d: "Browser pixel and server CAPI copies, deduplicated by event_id." }),
  I("lead_submitted", "tiktok", "standard event", "SubmitForm", { std: true, d: "Confirm the TikTok standard event name chosen for leads in Events Manager." }),
  I("lead_submitted", "gads", "conversion action", "lead_submitted", { label: "Website lead", d: "Primary acquisition conversion today." }),
  I("lead_submitted", "amplitude", "event", "lead_submitted"),
  I("lead_submitted", "ledger", "event_type", "web_lead_submitted", { d: "Manual v1.1 event map uses web_lead_submitted; dataLayer and GA4 use lead_submitted." }),
  I("whatsapp_clicked", "datalayer", "dataLayer event", "whatsapp_clicked"),
  I("whatsapp_clicked", "gtm", "trigger", "whatsapp_clicked", { container: GTM, label: "CE - whatsapp_clicked" }),
  I("whatsapp_clicked", "ga4", "event", "whatsapp_clicked"),
  I("whatsapp_clicked", "amplitude", "event", "whatsapp_clicked"),
  I("pricing_viewed", "datalayer", "dataLayer event", "pricing_viewed"),
  I("pricing_viewed", "ga4", "event", "pricing_viewed"),
  I("product_viewed", "datalayer", "dataLayer event", "product_viewed"),
  I("product_viewed", "ga4", "event", "view_item", { std: true, d: "GA4 recommended event." }),
  I("savings_estimate_viewed", "datalayer", "dataLayer event", "savings_estimate", { d: "Manual 4.7.6 calls it 'savings estimate'." }),
  I("chat_started", "respond", "webhook event", "New Incoming Message", { std: true }),
  I("chat_started", "ledger", "event_type", "chat_started"),
  I("chat_started", "amplitude", "event", "chat_started"),
  I("high_intent_reached", "ledger", "event_type", "high_intent_reached"),
  I("high_intent_reached", "amplitude", "event", "high_intent_reached"),
  I("contact_captured", "ledger", "event_type", "contact_captured"),
  I("credit_assessed", "ledger", "event_type", "credit_assessed"),
  I("credit_qualified", "ledger", "event_type", "credit_qualified"),
  I("credit_qualified", "meta", "custom event", "[confirm name] 620+ signal", { state: "live", d: "Per Aug 2026 Ivy review, the 620+ threshold is sent back to ad platforms. Event name and platforms to confirm. Blocked by G1 until approved." }),
  I("contract_signed", "ledger", "event_type", "contract_signed"),
  I("contract_signed", "gads", "conversion action", "contract_signed", { label: "Contract signed (offline)" }),
  I("credit_approved", "ledger", "event_type", "credit_approved"),
  I("credit_approved", "meta", "business messaging event", "QualifiedLead", { std: true, d: "CTWA leads only, within 7 days of the ad click." }),
  I("credit_approved", "gads", "conversion action", "credit_approved", { label: "Credit approved (offline)" }),
  I("credit_approved", "tiktok", "CRM event", "credit_approved"),
  I("installation_completed", "ledger", "event_type", "installation_completed"),
  I("commissioning_completed", "zuper", "webhook event", "Job status changed", { std: true, d: "Filter to the commissioning-complete status." }),
  I("commissioning_completed", "ledger", "event_type", "commissioning_completed"),
  I("commissioning_completed", "amplitude", "event", "commissioning_completed"),
  I("commissioning_completed", "gads", "conversion action", "commissioning_completed", { label: "Commissioned install (offline)" }),
  I("commissioning_completed", "tiktok", "CRM event", "commissioning_completed"),
  I("revenue_recognised", "ledger", "event_type", "revenue_recognised"),
  I("event_id", "datalayer", "dataLayer key", "event_id"),
  I("event_id", "gtm", "variable", "event_id", { container: GTM, label: "DLV - event_id" }),
  I("event_id", "ledger", "column", "event_id"),
  I("event_id", "meta", "parameter", "event_id", { std: true }),
  I("event_id", "amplitude", "parameter", "insert_id", { std: true, d: "Set insert_id = ledger event_id." }),
  I("lead_id", "datalayer", "dataLayer key", "lead_id"),
  I("lead_id", "gtm", "variable", "lead_id", { container: GTM, label: "DLV - lead_id" }),
  I("lead_id", "ledger", "column", "lead_id"),
  I("contract_id", "ledger", "column", "contract_id"),
  I("contract_id", "freshsales", "custom field", "[confirm field name]", { d: "Confirm the Freshsales field holding the contract number." }),
  I("contract_id", "zuper", "field", "[confirm field name]", { d: "Confirm the Zuper job field referencing the contract." }),
  I("zuper_job_id", "ledger", "column", "zuper_job_id"),
  I("phone_e164", "freshsales", "field", "mobile_number", { state: "live", std: true, d: "Normalised to +27 format by the Freshsales to Amplitude webhook (Ivy)." }),
  I("phone_e164", "amplitude", "user identity", "user_id", { state: "live", std: true, d: "Ivy closed loop uses normalised phone as Amplitude user_id. Personal data in analytics: review with the identifier decision." }),
  I("phone_e164", "ga4", "user-provided data", "email", { state: "live", d: "Known Ivy bug: phone mapped into the email slot of GA4 enhanced conversions. Confirm if fixed." }),
  I("gclid", "ledger", "column", "gclid"),
  I("gclid", "gads", "match key", "gclid", { std: true }),
  I("fbc", "ledger", "column", "fbc"),
  I("ttclid", "ledger", "column", "ttclid"),
  I("ctwa_clid", "respond", "referral metadata", "ctwa_clid", { std: true, d: "Captured automatically for CTWA conversations." }),
  I("ctwa_clid", "ledger", "column", "ctwa_clid"),
  I("ctwa_clid", "meta", "user_data", "ctwa_clid", { std: true }),
  I("product_interest", "datalayer", "dataLayer key", "product_interest"),
  I("product_interest", "gtm", "variable", "product_interest", { container: GTM, label: "DLV - product_interest" }),
  I("product_interest", "ga4", "event parameter", "product_interest"),
  I("lead_channel", "datalayer", "dataLayer key", "lead_channel"),
  I("form_type", "datalayer", "dataLayer key", "form_type"),
  I("consent_status", "ga4", "consent", "ad_user_data / ad_personalization", { std: true }),
  I("intent_score", "ledger", "table", "intent_score_history"),
  I("app_install", "branch", "standard event", "INSTALL", { std: true, d: "Branch install attribution; confirm which ad networks Branch forwards to." }),
  I("app_install", "firebase", "automatic event", "first_open", { std: true, d: "Firebase automatic event." }),
  I("app_open", "branch", "standard event", "OPEN", { std: true }),
  I("app_open", "firebase", "automatic event", "app_open", { std: true }),
  I("meter_linked", "firebase", "event", "[confirm name]", { d: "Confirm the Firebase event name the app uses for meter linking." }),
  I("topup_completed", "firebase", "event", "[confirm name]", { d: "Confirm the Firebase event name the app uses for top-ups." }),
  I("app_instance_id", "firebase", "identifier", "app_instance_id", { std: true }),
  I("branch_referring_link", "branch", "link data", "~referring_link", { std: true, d: "Branch reserved link-data key." }),
  I("credit_score", "freshsales", "field", "[confirm field name]", { state: "live", d: "Internal only." })
];

const ISSUES = [
  { sec: "pb49", ref: "GA4 enhanced conversions", title: "Phone mapped into the email slot in GA4 enhanced conversions", detail: "Identified during Project Ivy attribution work. Confirm whether it has been fixed; if not, correct the user-provided data mapping in GTM.", severity: "medium" }
];

async function seed() {
  const done = await q("SELECT value FROM meta WHERE key='seeded_v1'");
  if (done.rowCount) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const k of KB) {
      await client.query(`INSERT INTO kb (id,title,system,pbs,summary,steps,practices,changes,sources,verified_on,verified_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
        [k.id, k.title, k.system, JSON.stringify(k.pbs), k.summary, JSON.stringify(k.steps), JSON.stringify(k.practices), JSON.stringify(k.changes), JSON.stringify(k.sources), k.verified_on, k.verified_by]);
    }
    for (const f of FIELDS) {
      await client.query(`INSERT INTO fields (id,name,kind,description,measures,pii,owner,aliases,expected)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [f.id, f.name, f.kind, f.description, f.measures, f.pii, f.owner, JSON.stringify(f.aliases), JSON.stringify(f.expected)]);
    }
    for (const i of IMPLS) {
      await client.query(`INSERT INTO impls (field_id,system,container,kind,name,label,parent,std,state,description)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [i.field_id, i.system, i.container, i.kind, i.name, i.label, i.parent, i.std, i.state, i.description]);
    }
    for (const s of ISSUES) {
      await client.query(`INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)`, [s.sec, s.ref, s.title, s.detail, s.severity]);
    }
    await client.query("INSERT INTO meta (key,value) VALUES ('seeded_v1',$1)", [new Date().toISOString()]);
    await client.query("COMMIT");
    console.log("Seeded knowledge base and tracking registry.");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const pw = process.env.ADMIN_PASSWORD || "";
  if (!email || !pw) return;
  const r = await q("SELECT id FROM users WHERE email=$1", [email]);
  if (r.rowCount) return;
  await q("INSERT INTO users (email,name,role,pw_hash,must_change) VALUES ($1,$2,'admin',$3,TRUE)",
    [email, process.env.ADMIN_NAME || "Admin", await bcrypt.hash(pw, 12)]);
  console.log("Created first admin:", email);
}

module.exports = { seed, ensureAdmin };
