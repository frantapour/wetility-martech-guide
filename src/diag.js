// One-off: print the GTM registry items to the server log (configuration only).
const { q } = require("./db");
module.exports = async function diag() {
  try {
    const rows = (await q(`SELECT id, container, kind, name, label, parent, field_id, state, std, description FROM impls WHERE system='gtm' ORDER BY container, kind, id`)).rows;
    console.log("DIAG gtm count", rows.length);
    for (let i = 0; i < rows.length; i += 30) console.log("DIAG gtm", JSON.stringify(rows.slice(i, i + 30).map(r => [r.id, r.container, r.kind, r.name, r.label, r.parent, r.field_id || "", r.state, (r.description || "").slice(0, 90)])));
    console.log("DIAG end");
  } catch (e) { console.log("DIAG error", e.message); }
};
