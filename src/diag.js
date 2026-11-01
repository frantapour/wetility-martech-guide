// Temporary: print the last Amplitude sync and its registry items (tracking plan only).
const { q } = require("./db");
module.exports = async function diag() {
  try {
    const a = (await q("SELECT at, detail FROM audit WHERE entity='import' AND entity_id='amplitude' ORDER BY at DESC LIMIT 1")).rows[0];
    console.log("DIAG amp sync", JSON.stringify(a || null));
    const r = (await q("SELECT kind, name, label, parent, field_id, description FROM impls WHERE system='amplitude' ORDER BY kind, name")).rows;
    console.log("DIAG amp count", r.length);
    for (let i = 0; i < r.length; i += 40) console.log("DIAG amp", JSON.stringify(r.slice(i, i + 40).map(x => [x.kind, x.name, x.parent, x.field_id || "", (x.description || "").replace(" Synced from Amplitude.", "").slice(0, 70)])));
    console.log("DIAG end");
  } catch (e) { console.log("DIAG error", e.message); }
};
