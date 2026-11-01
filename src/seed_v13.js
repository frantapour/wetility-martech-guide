// v13: Amplitude project picture confirmed by Franta (1 Nov 2026).
const { q } = require("./db");
const TITLE = "Wetility has more than one Amplitude project";
const DETAIL = "Confirmed 1 Nov 2026. Three projects:\n- 'Wetility' (API key 3ffe3f08…): loaded on every page by GTM's 'Amplitude SDK Initialisation' tag; holds only automatic page views, clicks, form events, sessions and Daily Ad Metrics.\n- Project 89b022e4…: holds the real tracking (59 events: the website events from the GTM 'Ampl Tag' tags plus respond.io, credit, site inspection, installation and CoC events).\n- Dark Matter project (2292…): not loaded by GTM. Delete once it shows no events in the last 30 days and no chart or dashboard uses it.\n\nDecide which of the two Wetility projects is the one source of truth (most likely 89b022e4, which has the funnel), point GTM's SDK initialisation at it, and move the Daily Ad Metrics integration there.";
async function seedV13() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v13'")).rowCount) return;
  await q("UPDATE issues SET detail=$2, severity='medium' WHERE title=$1", [TITLE, DETAIL]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v13',$1)", [new Date().toISOString()]);
  console.log("Applied Amplitude projects v13.");
}
module.exports = { seedV13 };
