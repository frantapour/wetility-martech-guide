// v33: DarkMatter Meta portfolio 1477402898998256 people review, 1 Nov 2026.
const { q } = require("./db");
const T = "Wetility's Meta data is reachable by everyone with full access to DarkMatter's portfolio";
const D = "DarkMatter PTY LTD portfolio 1477402898998256 owns the Wetillity app and app dataset, and the Wetility website dataset is shared with it. 19 people are in it; 8 have full access, including two on personal email addresses (a Gmail and a Yahoo address) and one on darkmattermarketing.net. Inactive people with access: Elizabeth Banda, Aimee Albertyn (apps and integrations), David McIntyre, Angus Morris. Vendors also present with basic access: RevX (platform@revx.ai), Palota, Redwood Analytics, Sprig Co. Studio. Wetility cannot manage DarkMatter's people; it controls what it shares. Ask DarkMatter (Kopano) to: remove inactive people; move full access on personal emails to company emails with two-factor; confirm which people work on Wetility. Note: Franta has full access to this portfolio (personal Facebook profile), so he can see what DarkMatter holds for Wetility; use it to take inventory, and agree any asset moves with Kopano rather than making them unilaterally.";
async function seedV33() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v33'")).rowCount) return;
  if (!(await q("SELECT 1 FROM issues WHERE title=$1", [T])).rowCount)
    await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ('pb42','Step 3',$1,$2,'medium')", [T, D]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v33',$1)", [new Date().toISOString()]);
  console.log("Applied DarkMatter portfolio review v33.");
}
module.exports = { seedV33 };
