// One-off: print GTM pixel and account IDs to the server log (configuration only).
const { q } = require("./db");
module.exports = async function diag() {
  try {
    const rows = (await q(`SELECT container, name, label, state, description FROM impls WHERE system='gtm' AND kind='pixel ID' ORDER BY label, name`)).rows;
    console.log("DIAG pixels", rows.length);
    for (const r of rows) console.log("DIAG px", JSON.stringify([r.container, r.label, r.name, r.state, r.description.slice(0, 200)]));
    const html = (await q(`SELECT label, description FROM impls WHERE system='gtm' AND kind='tag' AND description LIKE 'Tag type html%' AND description NOT LIKE '%IDs:%'`)).rows;
    console.log("DIAG html-no-id", JSON.stringify(html.map(r => r.label + (r.description.includes("paused") ? " (paused)" : ""))));
    const c = (await q(`SELECT container, kind, count(*)::int n, max(at) last FROM impls WHERE system='gtm' GROUP BY 1,2 ORDER BY 1,2`)).rows; console.log("DIAG containers", JSON.stringify(c));
    const t = (await q(`SELECT container, label, parent, description FROM impls WHERE system='gtm' AND kind='tag' AND (label ~* 'pixel|meta|facebook|tiktok|google tag|linkedin|sc tag' ) ORDER BY container, label`)).rows;
    for (const r of t) console.log("DIAG tag", JSON.stringify([r.container, r.label, r.parent.slice(0, 60), r.description.slice(0, 160)]));
    console.log("DIAG end");
  } catch (e) { console.log("DIAG error", e.message); }
};
