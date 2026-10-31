// v7: Freshsales Deals layout, custom sales activities, Power BI connector, and Deals findings (31 Oct 2026).
// Items already in the registry (same system + part + name or label) are left untouched.
const { q, pool } = require("./db");
const Importer = require("../public/importer.js");
const DEALS = require("./data/freshsales_deals_layout.json");
const NOTE = "Freshsales Deals layout, 31 Oct 2026.";

const ISSUES = [
  ["pb45", "General", "medium", "Credit score is stored in three Freshsales fields",
    "Contacts > Credit Score, Deals > Credit Score (Lead) and Deals > Credit Team Credit Score. Decide which is the source and which are copies; every copy is another sensitive field that can leak into exports, Power BI or integrations."],
  ["pb45", "General", "medium", "The same facts are held on both Contacts and Deals in Freshsales",
    "Meter Number (twice on Contacts, once on Deals), One Bill Status, Debit Order Date, Lost reason, Referrer Code, Partnership Code, address fields, Contract Signed. Inside Deals, 'Promotion' and 'Promotions' look like the same field twice. Pick one home per fact; see the consistency check for the list."],
  ["pb45", "General", "high", "ID copies, bank statements and payslips are stored as Freshsales deal attachments",
    "Deals > Attachments holds Copy of ID, Copy of Spouse's ID, Proof of Address, three bank statements, three payslips and the CoC; Deals also hold employment status and marital property regime. Normal for credit vetting, but it must be in the Information Officer's data map (gate G1) with who can see it, including agency and integration users (for example the Power BI connector)."],
  ["pb49", "General", "low", "Residential, Luxe, A2Pay and Flare share one Freshsales Deals object",
    "Flare capex values and residential subscription totals sit in the same deal fields. Every report and dashboard must filter by pipeline, or totals mix business lines."],
  ["pb46", "General", "medium", "Installation dates live on Freshsales deals; reconcile them with Zuper",
    "Deals hold Installation Start Date, Installation End Date, Installation Duration and Term start / COC issued on, presumably copied from Zuper. These are the fields the Freshsales to Zuper reconciliation (playbook 4.6) should compare. 'Deal Lost prior to / after Credit Approval' also exist and should become standard fields for the pre-credit drop-out KPI."],
  ["pb46", "General", "low", "'Contract Sent' is recorded three ways in Freshsales",
    "As a sales activity, as a lifecycle stage and as a date field on Contacts. Choose the date field as the source for contract_sent and treat the others as workflow aids."]
];

async function seedV7() {
  const done = await q("SELECT value FROM meta WHERE key='seeded_v7'");
  if (done.rowCount) return;
  const fields = (await q("SELECT id,name,aliases,status FROM fields")).rows;
  const items = [
    ...DEALS.map(d => { const s = Importer.suggest({ name: d.name, label: d.label }, fields); return { system: "freshsales", container: "Deals", kind: "field", name: d.name, label: d.label, parent: d.parent, field_id: s ? s.id : null, std: true, state: "live", description: NOTE }; }),
    ...[["Contract Sent", "contract_sent"], ["First Attempted Call", null], ["Call to consult", null], ["Follow Up Chat", null]].map(([l, f]) => ({ system: "freshsales", container: "Sales activities", kind: "field", name: Importer.slug(l), label: l, parent: "Custom sales activities", field_id: f, std: true, state: "live",
      description: l === "First Attempted Call" ? "Custom sales activity. Basis for a speed-to-lead KPI (time from contact created to first attempted call)." : l === "Follow Up Chat" ? "Custom sales activity. Used as a contact-score signal." : "Custom sales activity." })),
    { system: "freshsales", container: "Integrations", kind: "integration", name: "powerbi_connector_app", label: "PowerBI Connector App", parent: "", field_id: null, std: true, state: "live", description: "Power BI reads data from Freshsales. Record who set it up, which account it uses and which fields it reads; credit fields in dashboards fall under the same privacy rules." }
  ];
  const client = await pool.connect();
  let added = 0;
  try {
    await client.query("BEGIN");
    for (const i of items) {
      const ex = await client.query("SELECT 1 FROM impls WHERE system=$1 AND container=$2 AND (lower(name)=lower($3) OR ($4<>'' AND lower(label)=lower($4)))", [i.system, i.container, i.name, i.label || ""]);
      if (ex.rowCount) continue;
      await client.query("INSERT INTO impls (field_id,system,container,kind,name,label,parent,std,state,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [i.field_id, i.system, i.container, i.kind, i.name, i.label || "", i.parent, i.std, i.state, i.description]);
      added++;
    }
    for (const [sec, ref, severity, title, detail] of ISSUES) {
      const ex = await client.query("SELECT 1 FROM issues WHERE title=$1", [title]);
      if (!ex.rowCount) await client.query("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
    }
    await client.query("INSERT INTO meta (key,value) VALUES ('seeded_v7',$1)", [new Date().toISOString()]);
    await client.query("COMMIT");
    console.log(`Applied Freshsales Deals findings v7 (${added} registry items).`);
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
module.exports = { seedV7 };
