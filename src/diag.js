// Temporary: whenever the GTM registry changes, print the pixel IDs and the ad-platform tags to the server log (configuration only).
const { q } = require("./db");
let last = "";
async function dump() {
  const m = (await q(`SELECT max(at)::text t, count(*)::int n FROM impls WHERE system='gtm'`)).rows[0];
  const key = m.t + "|" + m.n; if (key === last) return; last = key;
  console.log("DIAG snapshot", key);
  for (const r of (await q(`SELECT name, label, state, description FROM impls WHERE system='gtm' AND kind='pixel ID' ORDER BY label`)).rows)
    console.log("DIAG px", JSON.stringify([r.label, r.state, r.description.slice(0, 220)]));
  for (const r of (await q(`SELECT kind, label, parent, description FROM impls WHERE system='gtm' AND kind='tag' AND (label ~* 'meta|facebook|tiktok|^tt-|google tag|google ads tag$|sc tag|snap') ORDER BY label`)).rows)
    console.log("DIAG tag", JSON.stringify([r.label, r.parent.slice(0, 120), r.description.slice(0, 140)]));
  console.log("DIAG end");
}
module.exports = async function diag() { const run = () => dump().catch(e => console.log("DIAG error", e.message)); await run(); setInterval(run, 60000).unref(); };
