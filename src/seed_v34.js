// v34: Versofy is a Wetility brand (Franta, 1 Nov 2026): treat its Meta portfolio and ad account as Wetility-owned.
const { q } = require("./db");
const NOTE = "Versofy is a Wetility brand. Its Meta portfolio (Versofy, 2378015762218064) and the 'Versofy Active (via Wetility)' ad account are Wetility group assets, not a third party: keep Versofy as a partner, apply the same security rules (two-factor, peer approval, ads MCP set to no actions), and include it in business verification and the decision on which portfolio stays.";
async function seedV34() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v34'")).rowCount) return;
  await q("UPDATE impls SET description=$2 WHERE system='meta' AND name=$1", ["10152035530993227", "Owned by the Versofy portfolio 2378015762218064. Versofy is a Wetility brand, so this is a Wetility group ad account. Opportunity score 84; 2 people with partial access. (Business settings, 1 Nov 2026)"]);
  if (!(await q("SELECT 1 FROM impls WHERE system='meta' AND name='2378015762218064'")).rowCount)
    await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('meta','Business settings','integration','2378015762218064','Versofy business portfolio (Wetility brand)','Partners',TRUE,'live',$1)", [NOTE]);
  await q("UPDATE issues SET detail = detail || $2 WHERE title LIKE $1 AND position('Versofy is a Wetility brand' in detail)=0", ["Meta partners:%", "\n\nUpdate 1 Nov 2026: " + NOTE]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v34',$1)", [new Date().toISOString()]);
  console.log("Applied Versofy as Wetility brand v34.");
}
module.exports = { seedV34 };
