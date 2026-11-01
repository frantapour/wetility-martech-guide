// v37: TikTok Business Center settings, admins and activity log, 1 Nov 2026 (corrects v36: the Business Center is verified).
const { q } = require("./db");
async function seedV37() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v37'")).rowCount) return;
  await q("UPDATE impls SET description=$2 WHERE system='tiktok' AND name=$1", ["7696451525908004916", "WETILITY (PTY) LTD; VERIFIED, Enterprise Business Center; created 14 Oct 2026 by Franta; account health Good. Two-step verification required for all members; allowed email domain list: wetility.energy (admins only). Admins: nolan@wetility.energy, joshua@wetility.energy (Joshua Coetzer), franta@wetility.energy (also Finance Admin); accounts@wetility.energy joined 28 Oct. Partners: DarkMatter Marketing 736663301369954321 (media agency on ad account 7455352392268169232 since 26 Oct, assigned by Franta); Coffee Creative Studio 7702376462396997684 (pending). Brand safety: inventory filter none. Leads Center: no lead data Aug to Nov 2026. (Business Center, 1 Nov 2026)"]);
  await q("UPDATE issues SET title=$2, detail=$3 WHERE title=$1", ["TikTok: Business Center unverified and @wetilityenergy is a Personal account", "TikTok: @wetilityenergy is a Personal account; Nolan is a Business Center admin", "Correction: the Business Center is verified (Enterprise), with two-step verification enforced and only wetility.energy emails allowed. The 'Verify now' banner is about the TikTok account @wetilityenergy, which is set as Personal: switch it to Business and verify it. Admins are Nolan, Joshua and Franta: if Nolan has left, remove him here too (he is also flagged on Meta). DarkMatter has Admin on the Wetility ad account; after the freeze, consider Operator. Brand safety inventory filter is None: set Standard after the freeze."]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v37',$1)", [new Date().toISOString()]);
  console.log("Applied TikTok Business Center settings v37.");
}
module.exports = { seedV37 };
