// v8: tidy-up and findings after the first Freshsales API sync (31 Oct 2026).
const { q, pool } = require("./db");

const ISSUES = [
  ["pb45", "General", "high", "Bank account details are stored as text on Freshsales contacts",
    "The API sync shows Contacts > Bank Name, Bank Account Holder, Bank Account (number) and Bank Branch Code as plain text fields, next to ID Number and Credit Score. Anyone with contact access, any export and any integration user (for example the Power BI connector) can read them. Confirm with the Information Officer (gate G1) who needs them, restrict field visibility to that role, and check whether they belong in the billing or debit-order system rather than the CRM."],
  ["pb46", "General", "medium", "Legacy Wetility Pipeline is still live, with 'test' and 'Duplicates/To be Deleted' stages",
    "The API sync shows four deal pipelines: Wetility Pipeline, Legacy Wetility Pipeline, PD&I Commercial Pipeline and FLARE Project Pipeline. The legacy one has a stage called 'test' set to 100% probability and a 'Duplicates/To be Deleted' stage. Move or close the remaining deals, then archive the pipeline so it stops feeding reports and forecasts."],
  ["pb46", "General", "medium", "Deal stage probabilities reach 100% long before a deal is won",
    "FLARE Project Pipeline is at 100% from 'Framework Received' onwards; PD&I Commercial Pipeline from 'LIFT Eng Proposal Completed'; Wetility Pipeline at 'Installation Complete' and 'Pending CoC'. Any weighted forecast counts these as certain revenue. Set probabilities from actual stage-to-won conversion, and keep 100% for Won only."],
  ["pb45", "General", "low", "139 hidden fields in Freshsales",
    "The API sync shows 49 hidden fields on Contacts, 63 on Deals and 27 on Accounts. Hidden fields still hold data, still export, and still reach integrations. Review them with Josh: delete the unused ones, and record what the rest are for in this registry."]
];
const APPEND = [
  ["Credit score is stored in three Freshsales fields",
    "Update from the API sync: it is four number fields (Contacts > Credit Score, Deals > Credit Score, Deals > Credit Score (Lead), Deals > Credit Team Credit Score) plus Contacts > Credit Score Group."],
  ["The same facts are held on both Contacts and Deals in Freshsales",
    "Update from the API sync: 33 field labels exist on both objects, including ID Number, Credit Score, Credit Check Date, Debit Order Date, Meter Number, Referrer Code, Partnership Code, Contract Signed, One Bill Status, GPS Coordinates and the address fields."],
  ["Freshsales lifecycle stages: funnel ends at Contract Signed, two 'won' outcomes, and a stage-reset rule",
    "Correction from the API sync: installation is tracked, but on deals, not contacts. Wetility Pipeline has Credit Approved, Pending Site Visit, Site Visit/Inspection Scheduled, Installation Scheduled, Installation Complete and Pending CoC before Won. The contact lifecycle still stops at contract, so report installs from the deal pipeline."]
];
// Paste-imported items that the API knows under another name: move the mapping and notes, then remove the old row.
const MERGE = [["Contacts", "contact_score", "lead_score"], ["Deals", "estimated_capex_zar", "cf_estimated_capex"]];

async function seedV8() {
  const done = await q("SELECT value FROM meta WHERE key='seeded_v8'");
  if (done.rowCount) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE impls SET parent = trim(regexp_replace(regexp_replace(parent, '^Translation Missing: En\\.Fields\\.(Cf )?(.+?)\\.Label$', '\\2', 'i'), '\\s+', ' ', 'g'))
      WHERE system='freshsales' AND parent ILIKE 'Translation Missing:%'`);
    await client.query(`UPDATE impls SET label = trim(label) WHERE system='freshsales' AND label <> trim(label)`);
    for (const [container, oldName, newName] of MERGE) {
      const o = await client.query("SELECT id, field_id, description FROM impls WHERE system='freshsales' AND container=$1 AND name=$2", [container, oldName]);
      const n = await client.query("SELECT id FROM impls WHERE system='freshsales' AND container=$1 AND name=$2", [container, newName]);
      if (!o.rowCount || !n.rowCount) continue;
      await client.query(`UPDATE impls SET field_id = COALESCE(field_id, $1), description = description || ' Earlier notes: ' || $2 WHERE id=$3`, [o.rows[0].field_id, o.rows[0].description, n.rows[0].id]);
      await client.query("DELETE FROM impls WHERE id=$1", [o.rows[0].id]);
    }
    for (const [sec, ref, severity, title, detail] of ISSUES) {
      const ex = await client.query("SELECT 1 FROM issues WHERE title=$1", [title]);
      if (!ex.rowCount) await client.query("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
    }
    for (const [title, note] of APPEND)
      await client.query("UPDATE issues SET detail = COALESCE(detail,'') || E'\\n\\n' || $2 WHERE title=$1 AND position($2 in COALESCE(detail,''))=0", [title, note]);
    await client.query("INSERT INTO meta (key,value) VALUES ('seeded_v8',$1)", [new Date().toISOString()]);
    await client.query("COMMIT");
    console.log("Applied Freshsales API sync findings v8.");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
module.exports = { seedV8 };
