// v11: Amplitude syncs from two projects were mixed in one "Tracking plan" part; remove the synced rows so each project re-syncs into its own part.
const { q } = require("./db");
async function seedV11() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v11'")).rowCount) return;
  const r = await q("DELETE FROM impls WHERE system='amplitude' AND container='Tracking plan' AND description LIKE '%Synced from Amplitude%'");
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v11',$1)", [new Date().toISOString()]);
  console.log(`Applied Amplitude clean-up v11 (${r.rowCount} rows removed).`);
}
module.exports = { seedV11 };
