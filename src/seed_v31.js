// v31: Meta portfolio 268835702018155 data sources and brand safety review, 1 Nov 2026.
const { q } = require("./db");
const ISSUES = [
  ["pb42", "Step 3", "medium", "wetility.energy is not verified as a domain in the Wetility Meta portfolio",
    "Business settings > Brand safety > Domains is empty in portfolio 268835702018155. Domain verification proves Wetility controls the website: it stops other businesses editing link previews to wetility.energy and gives Wetility the say over which events count for iPhone users. Steps: (1) check Domains in the other portfolio 1635612940192332 (it owns the website dataset; it may already be verified there); (2) if not verified anywhere, verify it in the portfolio Wetility keeps long term, using the DNS TXT method (Josh adds the record); (3) never verify it in an agency's portfolio."],
  ["pb42", "Step 3", "low", "No publisher block list on Meta ads",
    "Brand safety > Publisher block lists is empty. Ads that run on Audience Network can show inside third-party apps and sites Wetility has not chosen. For a financed product, either exclude Audience Network in campaign placements or add a block list. Check placements after 19 January (no campaign changes during the freeze)."]
];
const NOTES = [
  ["shared-audiences", "Shared audiences: none", "Business settings", "Checked 1 Nov 2026: no audiences shared with or from Cortado, DarkMatter, Freshworks, GrowthCharter, Versofy or respond.io. Nothing to claw back. Partners listed: Freshworks Inc 1180820155313525 (Freshsales lead sync) and respond.io 235609652134321 (WhatsApp)."],
  ["custom-conversions", "Custom conversions: none", "Business settings", "Checked 1 Nov 2026: no custom conversions or offline event sets in portfolio 268835702018155. Any custom conversions live in the ad accounts (Growth Charter-owned) or the other portfolio."]
];
async function seedV31() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v31'")).rowCount) return;
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  for (const [name, label, parent, desc] of NOTES)
    if (!(await q("SELECT 1 FROM impls WHERE system='meta' AND name=$1", [name])).rowCount)
      await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('meta','Business settings','integration',$1,$2,$3,TRUE,'live',$4)", [name, label, parent, desc]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v31',$1)", [new Date().toISOString()]);
  console.log("Applied Meta data sources and brand safety v31.");
}
module.exports = { seedV31 };
