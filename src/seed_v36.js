// v36: TikTok Business Center WETILITY (PTY) LTD 7696451525908004916 review, 1 Nov 2026.
const { q } = require("./db");
const ITEMS = [
  ["7696451525908004916", "Wetility TikTok Business Center", "Business Center", "WETILITY (PTY) LTD; Franta is Admin and Finance Manager; 4 users; not verified. Partners: DarkMatter Marketing 736663301369954321 (agency); Coffee Creative Studio 7702376462396997684 (pending request, 30 Oct 2026)."],
  ["7455352392268169232", "Wetility Energy (TikTok ad account)", "Advertiser accounts", "OWNED BY WETILITY (PTY) LTD. Approved; 4 members; 1 linked asset. Shared with DarkMatter Marketing as media buying agency, role Admin, since 26 Oct 2026."],
  ["7696450606701019142", "WETILITY (PTY) LTD (TikTok ad account)", "Advertiser accounts", "Owned by Wetility; deactivated; no assets. Leave as is."],
  ["wetilityenergy", "@wetilityenergy (TikTok account)", "TikTok accounts", "Linked to the Business Center and 1 ad account, but set as a Personal account. Switch to Business and verify."]
];
const ISSUES = [
  ["pb42", "Step 3", "high", "TikTok: an ad account transfer request and an unknown agency request are waiting in Wetility's Business Center",
    "Accounts shows '1 ad account transfer request' (not yet reviewed), and Partners shows Coffee Creative Studio (CCStudio, BC 7702376462396997684) asking on 30 Oct 2026 to be a media buying agency. Accepting the wrong transfer could move an ad account out of Wetility's ownership; approving an unknown agency gives it access to ads and spend. Review the transfer to see what moves where before acting; decline Coffee Creative Studio unless someone at Wetility hired them (check whether they are linked to Cortado)."],
  ["pb42", "Step 3", "low", "TikTok: Business Center unverified and @wetilityenergy is a Personal account",
    "Verify the Business Center (same company documents as Meta business verification) and switch @wetilityenergy to a Business account. DarkMatter has Admin on the Wetility ad account; after the freeze, consider Operator so the agency runs campaigns but cannot manage members."]
];
async function seedV36() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v36'")).rowCount) return;
  for (const [name, label, parent, desc] of ITEMS) {
    const ex = await q("SELECT id FROM impls WHERE system='tiktok' AND name=$1", [name]);
    if (ex.rowCount) await q("UPDATE impls SET label=$2, parent=$3, description=$4 WHERE id=$1", [ex.rows[0].id, label, parent, desc + " (Business Center, 1 Nov 2026)"]);
    else await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('tiktok','Business Center','integration',$1,$2,$3,TRUE,$4,$5)", [name, label, parent, /deactivated/.test(desc) ? "deprecated" : "live", desc + " (Business Center, 1 Nov 2026)"]);
  }
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  await q("UPDATE issues SET detail = detail || $1 WHERE detail ILIKE '%7455352392268169232%' AND position('Wetility owns ad account' in detail)=0", ["\n\nUpdate 1 Nov 2026: Wetility owns ad account 7455352392268169232 in its own Business Center; DarkMatter has Admin on it as agency. Pixel CVH6OG3C77U2AAG9KD8G is not in Wetility's Business Center."]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v36',$1)", [new Date().toISOString()]);
  console.log("Applied TikTok Business Center review v36.");
}
module.exports = { seedV36 };
