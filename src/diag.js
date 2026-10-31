// One-off: print GTM pixel and account IDs to the server log (configuration only).
const { q } = require("./db");
module.exports = async function diag() {
  try {
    const rows = (await q(`SELECT name, label, state, description FROM impls WHERE system='gtm' AND kind='pixel ID' ORDER BY label, name`)).rows;
    console.log("DIAG pixels", rows.length);
    for (const r of rows) console.log("DIAG px", JSON.stringify([r.label, r.name, r.state, r.description.slice(0, 400)]));
    const html = (await q(`SELECT label, description FROM impls WHERE system='gtm' AND kind='tag' AND description LIKE 'Tag type html%' AND description NOT LIKE '%IDs:%'`)).rows;
    console.log("DIAG html-no-id", JSON.stringify(html.map(r => r.label + (r.description.includes("paused") ? " (paused)" : ""))));
    console.log("DIAG end");
  } catch (e) { console.log("DIAG error", e.message); }
};
