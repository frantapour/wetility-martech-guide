// v15: an access-review gap was inserted as G5, so statuses already saved for G5 to G21 move up by one.
const { q } = require("./db");
async function seedV15() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v15'")).rowCount) return;
  for (let n = 21; n >= 5; n--) await q("UPDATE statuses SET key=$2 WHERE key=$1", ["gap-G" + n, "gap-G" + (n + 1)]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v15',$1)", [new Date().toISOString()]);
  console.log("Applied gap renumbering v15.");
}
module.exports = { seedV15 };
