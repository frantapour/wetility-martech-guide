// One-off: print a summary of the last Freshsales API sync to the server log (configuration only).
const { q } = require("./db");
module.exports = async function diag() {
  try {
    const a = await q("SELECT at, detail FROM audit WHERE entity='import' AND entity_id='freshsales' ORDER BY at DESC LIMIT 1");
    if (!a.rowCount) return console.log("DIAG no freshsales sync");
    const at = a.rows[0].at;
    console.log("DIAG sync", JSON.stringify({ at, ...a.rows[0].detail }));
    const rows = (await q(`SELECT i.id, i.container, i.kind, i.name, i.label, i.parent, i.field_id, i.state, i.description, i.at >= $1::timestamptz - interval '1 minute' AS touched, f.pii
      FROM impls i LEFT JOIN fields f ON f.id=i.field_id WHERE i.system='freshsales' ORDER BY i.container, i.id`, [at])).rows;
    const by = {};
    for (const r of rows) { const k = r.container; by[k] ||= { total: 0, touched: 0, mapped: 0, notTouchedLive: 0 }; const b = by[k]; b.total++; if (r.touched) b.touched++; if (r.field_id) b.mapped++; if (!r.touched && r.state !== "deprecated") b.notTouchedLive++; }
    console.log("DIAG containers", JSON.stringify(by));
    const touched = rows.filter(r => r.touched);
    for (let i = 0; i < touched.length; i += 35)
      console.log("DIAG items", JSON.stringify(touched.slice(i, i + 35).map(r => [r.id, r.container, r.kind, r.name, r.label, r.parent, r.field_id || "", r.pii || "", (r.description || "").replace("Synced from Freshsales API, ", "").slice(0, 60)])));
    const stale = rows.filter(r => !r.touched && r.state !== "deprecated");
    for (let i = 0; i < stale.length; i += 50)
      console.log("DIAG stale", JSON.stringify(stale.slice(i, i + 50).map(r => [r.id, r.container, r.kind, r.name, r.label])));
    console.log("DIAG end");
  } catch (e) { console.log("DIAG error", e.message); }
};
