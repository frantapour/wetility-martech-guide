// v20: respond.io setup was imported from the contact, conversation and message exports, so mark its connection done.
const { q } = require("./db");
async function seedV20() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v20'")).rowCount) return;
  const r = await q("SELECT value FROM settings WHERE key='conn:respond'");
  const st = r.rowCount ? JSON.parse(r.rows[0].value) : { values: {}, secrets: {}, lastTest: null, lastSync: null };
  if (!st.manual) st.manual = { at: new Date().toISOString(), by: "Franta", note: "Imported from the contact, conversation and message exports (field names only)" };
  await q(`INSERT INTO settings (key,value,updated_at) VALUES ('conn:respond',$1,now()) ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=now()`, [JSON.stringify(st)]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v20',$1)", [new Date().toISOString()]);
  console.log("Applied respond.io marked done v20.");
}
module.exports = { seedV20 };
