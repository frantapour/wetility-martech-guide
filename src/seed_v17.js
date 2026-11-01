// v17: respond.io contact fields from the contact data export header (field names only), 1 Nov 2026.
const { q, pool } = require("./db");
const Importer = require("../public/importer.js");
const STD = ["ContactID", "FirstName", "LastName", "PhoneNumber", "Email", "Country", "Language", "Tags", "Status", "Lifecycle", "Assignee", "Collaborators", "LastInteractionTime", "DateTimeCreated", "Channels"];
const CUSTOM = ["id_number", "credit_score", "lead_interest", "monthly_spend", "system_choice", "contracting_method", "installation_address", "property_ownership_status", "indoor_installation_possible", "account_name", "branch_code", "account_number", "bank_name", "additional_panels", "additional_batteries", "debit_order_date", "net_monthly_income", "gross_monthly_income", "freshsales_contact_id", "sign_now_contracting", "sign_now_contract_url", "cf_active_contract", "cf_product_sku", "cf_selected_product", "signnow_document_id", "contract_status", "contract_generated_at", "customer_signed_at", "credit_signed_at", "crm_sync_status", "crm_synced_at", "signing_error_at", "support_issue", "deal_owner_status", "sales_owner", "created_source", "customer_address", "passport", "referral_code", "referrer_name", "messaging_subscription_status", "latest_job_submitted", "cf_subscription_status", "returning_contact", "last_assignee_id", "zuper_customer_uid", "zuper_job_uid", "conversation_summary", "attribution_id", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "gbraid", "wbraid", "fbclid", "ttclid", "msclkid", "amplitude_device_id", "landing_url", "referrer", "missed_call", "zuper_ticket_number", "id_requested", "brain_status", "brain_result", "brain_request_id", "brain_data", "open_ticket_uid", "freshsales_id", "brain_summary", "brain_task", "new_contract_url"];
const SENSITIVE = /id_number|passport|credit_score|account_name|branch_code|account_number|bank_name|monthly_income|debit_order/;
const GROUP = n => /^utm_|gbraid|wbraid|fbclid|ttclid|msclkid|attribution_id|amplitude_device_id|landing_url|^referrer$/.test(n) ? "Attribution" : /brain_|conversation_summary/.test(n) ? "AI agent" : /sign|contract|credit_signed/.test(n) ? "Contracting" : /zuper|ticket|support/.test(n) ? "Zuper and support" : /freshsales|crm_/.test(n) ? "CRM sync" : SENSITIVE.test(n) || /income/.test(n) ? "Identity, credit and banking" : "Sales qualification";
const ISSUES = [
  ["pb45", "General", "high", "respond.io holds ID, passport, credit score, bank details and income",
    "The respond.io contact export includes id_number, passport, credit_score, account_name, branch_code, account_number, bank_name, net_monthly_income, gross_monthly_income and debit_order_date, next to AI fields (brain_data, brain_summary, conversation_summary). respond.io is a messaging tool used by sales agents and the AI agent; every agent, integration and data export can see these. Keep these values in the credit and billing systems only, with restricted access, and keep a reference (freshsales_id) in respond.io. Information Officer to confirm the data map (gate G1). Do not upload respond.io contact exports anywhere: they contain this data."],
  ["pb410", "Step 2", "high", "WhatsApp leads cannot be sent back to Meta or Google: no ctwa_clid or gclid in respond.io",
    "respond.io stores utm_*, fbclid, ttclid, msclkid, gbraid, wbraid, attribution_id and amplitude_device_id, which is a good base. But there is no ctwa_clid (the click ID Meta needs for Conversions API for Business Messaging, 7-day window) and no gclid (Google's main click ID; gbraid and wbraid only cover some iOS traffic). Capture ctwa_clid from the click-to-WhatsApp ad referral and gclid from the landing URL, so WhatsApp leads and later stages can be reported back to Meta and Google."],
  ["pb45", "General", "medium", "respond.io duplicates CRM identifiers and contract fields",
    "Two Freshsales IDs (freshsales_contact_id and freshsales_id), two contract URLs (sign_now_contract_url and new_contract_url), product held as cf_product_sku and cf_selected_product, and a mix of cf_ and plain names. Pick one field per fact, decide which system owns it (Freshsales for CRM facts, SignNow for contracts), and sync one way."]
];
async function seedV17() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v17'")).rowCount) return;
  const fields = (await q("SELECT id,name,aliases,status FROM fields")).rows;
  const client = await pool.connect(); let added = 0;
  try {
    await client.query("BEGIN");
    for (const [name, kind] of [...STD.map(n => [n, "contact field"]), ...CUSTOM.map(n => [n, "contact field"])]) {
      const custom = CUSTOM.includes(name);
      const ex = await client.query("SELECT 1 FROM impls WHERE system='respond' AND container='Contact fields' AND lower(name)=lower($1)", [name]);
      if (ex.rowCount) continue;
      const sug = Importer.suggest({ name, label: "" }, fields);
      await client.query("INSERT INTO impls (field_id,system,container,kind,name,label,parent,std,state,description) VALUES ($1,'respond','Contact fields',$2,$3,'',$4,TRUE,'live',$5)",
        [sug ? sug.id : null, kind, name, custom ? GROUP(name) : "Standard respond.io field", `${custom ? "Custom contact field" : "Standard contact field"} (respond.io contact export, 1 Nov 2026).${SENSITIVE.test(name) ? " Sensitive: identity, credit or banking data." : ""}`]);
      added++;
    }
    for (const [sec, ref, severity, title, detail] of ISSUES) {
      const ex = await client.query("SELECT 1 FROM issues WHERE title=$1", [title]);
      if (!ex.rowCount) await client.query("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
    }
    await client.query("INSERT INTO meta (key,value) VALUES ('seeded_v17',$1)", [new Date().toISOString()]);
    await client.query("COMMIT");
    console.log(`Applied respond.io fields v17 (${added} items).`);
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
module.exports = { seedV17 };
