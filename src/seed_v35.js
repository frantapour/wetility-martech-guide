// v35: Google Ads account sits under iLead; Wetility has no access (Franta, 1 Nov 2026).
const { q } = require("./db");
const T = "Wetility has no access to its own Google Ads account (held under iLead)";
const D = "Franta, 1 Nov 2026: the Google Ads account (AW-11401670719) sits under iLead's ownership and nobody at Wetility has access. Wetility cannot see spend, conversions, enhanced conversions or the click data that G13 needs, and would lose the account if the relationship ended badly. Unlike Meta ad accounts, a Google Ads customer account can keep its history when the agency manager account unlinks, provided Wetility has an Admin user on it first. Steps: (1) iLead invites a Wetility company email as Admin on the customer account; (2) iLead confirms in writing that the account, its history and conversions are Wetility's; (3) check whose payments profile pays; (4) after 19 January, create a Wetility manager account, link it, and decide whether iLead keeps access through its own manager account. No unlinking or billing change during the freeze.";
async function seedV35() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v35'")).rowCount) return;
  if (!(await q("SELECT 1 FROM issues WHERE title=$1", [T])).rowCount)
    await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ('pb42','Step 3',$1,$2,'high')", [T, D]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v35',$1)", [new Date().toISOString()]);
  console.log("Applied Google Ads ownership v35.");
}
module.exports = { seedV35 };
