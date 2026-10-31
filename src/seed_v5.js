// v5: what was found in Freshsales Admin Settings on 31 Oct 2026 (walked through screen by screen with Franta).
// Items are only added if the same system + container + name is not already in the registry, so imports done in the app are kept.
const { q, pool } = require("./db");
const slug = s => String(s).toLowerCase().replace(/^q:\s*/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
const NOTE = "Found in Freshsales Admin Settings, 31 Oct 2026.";

const FIELDS = [
  ["crm_contact_score", "crm_contact_score", "attribute", "Freshsales (Freddy) contact score built from website visits, calls, chats, electricity bill, credit score, ID number and activity signals.", "Sales prioritisation inside Freshsales", "sensitive", "Josh", ["freshsales"], ["contact_score"]]
];

const I = (system, container, kind, label, o = {}) => ({ system, container, kind, name: o.name || slug(label), label: o.name ? label : (slug(label) === label ? "" : label), parent: o.parent || "", field_id: o.field || null, std: o.std ?? true, state: o.state || "live", description: o.d || NOTE });
const STAGES = [["Contacts Received", ["Returning Contacts"]], ["Credit Check", ["Qualified", "Non-Qualified"]], ["Assigned Contact", ["Assigned"]], ["Attempted Contact", ["Attempted Contact - No response", "Attempted Contact - Follow-Up Ongoing"]],
  ["Contacted", ["Ready - Send Contract to Customer", "Not Ready - Price Concern", "Not Ready - Contract Concern", "Not Ready - Other Issues", "Not Ready - Timing", "Likely to be Lost"]],
  ["Contract Sent", ["Contract Sent - Follow-Up Ongoing", "Screened Customers", "Contract Signed", "Lost"]]];
const STAGE_FIELD = { "Credit Check": "credit_assessed", "Qualified": "credit_qualified", "Contract Sent": "contract_sent", "Contract Signed": "contract_signed" };
const ITEMS = [
  I("umbraco", "talk-to-us page", "integration", "Freshsales CRM tracking code", { name: "freshsales_crm_tracking_code", std: false, state: "planned",
    d: "Freshworks tracking script //eu.fw-cdn.com/10210586/151072.js (EU-hosted account). Registered domain: www.wetility.energy/talk-to-us. Settings: jQuery included; chat off; track source/medium/campaign ON; track other URL parameters (e.g. GCLID) ON. Contact scoring uses 'visited website / calculator / ai mode' events, which suggests it is live. Confirm with 'Check website integration' in Freshsales, then set to live or deprecated." }),
  I("freshsales", "Contacts", "field", "Contact score", { name: "contact_score", field: "crm_contact_score",
    d: "Freddy contact score. Positive: visited website, calculator or AI Mode (7 days), incoming calls, follow-up chat, call duration, credit score > 595, re-entered website workflow, monthly bill, deceased = No. Negative: email bounced, credit score < 595, ID number empty, monthly bill, no activity 30+ days, unsubscribed, lost reason = Attempting Contact. Automation stub: score > [blank] moves to Contacts Received. Credit-derived: internal use only." }),
  ...["Name", "Website", "Phone", "Sales owner", "Tags"].map(l => I("freshsales", "Accounts", "field", l, { parent: "Basic information" })),
  I("freshsales", "Lifecycle stages", "lifecycle stage", "Calendly scheduled", { parent: "Disabled stages", state: "deprecated" }),
  ...STAGES.flatMap(([st, ss]) => [I("freshsales", "Lifecycle stages", "lifecycle stage", st, { field: STAGE_FIELD[st] || null }), ...ss.map(x => I("freshsales", "Lifecycle stages", "lifecycle status", x, { parent: st, field: STAGE_FIELD[x] || null }))]),
  I("freshsales", "Lifecycle stages", "workflow", "Whenever a deal is added, change contact's stage to Contacts Received", { parent: "Stage rules", d: "Automatic stage rule. Resets returning contacts to the first stage whenever a new deal is created." }),
  I("freshsales", "Lifecycle stages", "workflow", "Whenever a deal is won, change contact's stage to Screened Customers", { parent: "Stage rules", d: "Automatic stage rule. Won deals land on 'Screened Customers', not 'Contract Signed'." }),
  I("freshsales", "Web forms", "integration", "[TEST] A2Pay Merchant Sign-Up", { state: "deprecated", d: "Freshsales web form, 0 contacts created, created ~3 years ago. Unused." }),
  I("freshsales", "Web forms", "integration", "Wetility customer satisfaction survey", { state: "deprecated", d: "Freshsales web form, 0 contacts created, created ~4 years ago. Unused." }),
  ...["Conferences & Events", "Newsletter", "Non-Marketing Emails From Our Company", "Product Updates", "Promotional"].map(l => I("freshsales", "Subscription types", "field", l, { state: "planned", d: "Default Freshsales email subscription type, unchanged since the account was created (~5 years ago). Confirm whether any contacts carry a subscription status." })),
  I("freshsales", "Custom modules", "module", "Payment Holiday", { d: "Custom module. Holds customer payment-relief data (personal financial information). Import its fields with 'Which part' = Payment Holiday." }),
  I("freshsales", "Custom modules", "module", "Broker CRM Project", { d: "Custom module for broker activity. Check for a lookup field linking it to Contacts or Deals; without one, broker-sourced deals cannot be attributed automatically." })
];

const ISSUES = [
  ["pb47", "Step 7", "medium", "Freshsales tracking script may be a second lead-capture and attribution path on the website",
    "Freshsales > CRM Tracking Code is set up for www.wetility.energy/talk-to-us with source/medium/campaign and URL-parameter tracking switched on. Contact scoring uses website-visit events, which suggests the script is live. If so, both the script and the website integration write source/UTM fields in Freshsales (first-touch values can be overwritten) and the script may create contacts outside the backend lead path. Check: Freshsales 'Check website integration', page source / GTM for fw-cdn.com/10210586. Then choose one owner of lead capture and attribution."],
  ["pb45", "General", "medium", "Freshsales contact score is built on credit score and ID number",
    "Contact scoring adds points for credit score > 595 and subtracts for < 595 and an empty ID number, alongside website, call and chat signals. The score is therefore credit-derived: internal sales use only, never in ad audiences or analytics. It also blends intent with eligibility; keep it separate from the chatbot Sales Intent Level Score. 'Deceased is No' adds points to everyone and has no effect on ranking."],
  ["pb46", "General", "medium", "Freshsales lifecycle stages: funnel ends at Contract Signed, two 'won' outcomes, and a stage-reset rule",
    "No installation or commissioning stage exists in Freshsales, so Zuper is the only record of installs. 'Screened Customers' and 'Contract Signed' both sit under Contract Sent, and the deal-won rule moves contacts to 'Screened Customers'. The rule 'whenever a deal is added, change stage to Contacts Received' resets returning contacts to the start, which may inflate top-of-funnel counts. Credit Check > Qualified / Non-Qualified exposes credit outcomes in stage names: never send these stage names to ad platforms."],
  ["pb45", "General", "low", "Email subscription types are untouched defaults; WhatsApp marketing consent location unknown",
    "Freshsales subscription types are the five defaults created ~5 years ago. Confirm whether contacts carry a subscription status and where WhatsApp and call marketing consent is recorded. Needed for the POPIA data map (gate G1)."],
  ["pb41", "Step 5", "medium", "Freshsales 'Meta Lead ID' field: confirm what fills it",
    "No Meta lead forms are connected in Freshsales, yet a Meta Lead ID field exists. If it has values, another integration (Zapier, LeadsBridge or an agency tool) is bringing Meta leads in. Record it and its owner account."],
  ["pb41", "Step 5", "low", "Two unused Freshsales web forms",
    "[TEST] A2Pay Merchant Sign-Up and Wetility customer satisfaction survey: 0 contacts each, created 3 and 4 years ago. Consider deleting so their public links cannot create junk contacts."]
];

const FRESHSALES_STEPS = [
  "Leads, Contacts & Accounts > Contacts > Fields: copy the whole layout, import with 'Which part' = Contacts. Same for Accounts.",
  "Leads, Contacts & Accounts > Contact Lifecycle Stages: copy the whole page and paste it; stages, statuses, disabled stages and stage rules are recognised automatically.",
  "Leads, Contacts & Accounts > Lead Capture with Social Media: check the Accounts, Ad accounts, Pages and Forms tabs; record each connection and who connected it as type 'integration'.",
  "Leads, Contacts & Accounts > Website Embed Code (CRM Tracking Code): record the script, its settings and the registered domains; click 'Check website integration' to see if it is live.",
  "Leads, Contacts & Accounts > Contact Scoring: record the score and its signals; mark it sensitive if it uses credit data.",
  "Leads, Contacts & Accounts > Web Forms, Subscription Types, Custom Modules: record each (custom module fields via 'Customize fields', one import per module).",
  "Deals & Pipelines > Deals > Fields, Pipelines (stages per pipeline, type 'deal stage'), Product Catalog (type 'product'), Sales Activities.",
  "Apps & Integrations: record every connected app, the account used to connect it, and what it writes into Freshsales.",
  "Best for exact field keys: ask Josh to save GET /api/settings/contacts/fields?include=field_group (and deals, sales_accounts) as JSON and import with format 'Freshsales fields API (JSON)'. It upgrades pasted labels to real cf_ keys without duplicates.",
  "Skip: Teams & Territories, Activity Goals, Quotas and Forecasting, LinkedIn Lead Gen Forms (unless connected), CRM Code Library (unless a Wetility system uses it)."
];

async function seedV5() {
  const done = await q("SELECT value FROM meta WHERE key='seeded_v5'");
  if (done.rowCount) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [id, name, kind, description, measures, pii, owner, expected, aliases] of FIELDS) {
      await client.query(`INSERT INTO fields (id,name,kind,description,measures,pii,owner,expected,aliases) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [id, name, kind, description, measures, pii, owner, JSON.stringify(expected), JSON.stringify(aliases)]);
    }
    let added = 0;
    for (const i of ITEMS) {
      const ex = await client.query("SELECT 1 FROM impls WHERE system=$1 AND container=$2 AND (lower(name)=lower($3) OR ($4<>'' AND lower(label)=lower($4)))", [i.system, i.container, i.name, i.label]);
      if (ex.rowCount) continue;
      await client.query(`INSERT INTO impls (field_id,system,container,kind,name,label,parent,std,state,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [i.field_id, i.system, i.container, i.kind, i.name, i.label, i.parent, i.std, i.state, i.description]);
      added++;
    }
    for (const [sec, ref, severity, title, detail] of ISSUES) {
      const ex = await client.query("SELECT 1 FROM issues WHERE title=$1", [title]);
      if (!ex.rowCount) await client.query("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
    }
    await client.query(`UPDATE kb SET steps=$1, verified_on='2026-10-31', verified_by='Checked in Freshsales' WHERE id='export-freshsales' AND updated_by IS NULL`, [JSON.stringify(FRESHSALES_STEPS)]);
    await client.query("INSERT INTO meta (key,value) VALUES ('seeded_v5',$1)", [new Date().toISOString()]);
    await client.query("COMMIT");
    console.log(`Applied Freshsales findings v5 (${added} registry items).`);
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
module.exports = { seedV5 };
