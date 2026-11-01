// v30: Meta portfolio 268835702018155 asset review (Pages, ad accounts, apps, Instagram, WhatsApp, messaging, catalogue, datasets), 1 Nov 2026.
const { q } = require("./db");
const ITEMS = [
  ["113601763670697", "Wetility Facebook Page", "Pages", "Owned by Wetility. Primary business Page. 5 people (Franta appears twice: two Facebook profiles)."],
  ["554889355978936", "Wetility Ad Account", "Ad accounts", "OWNED BY WETILITY. Opportunity score 100. Cortado Business Manager has full access. The Wetility-owned account campaigns can move to."],
  ["1006220581257195", "Wetility Energy Ad Account", "Ad accounts", "OWNED BY GROWTHCHARTER (former agency). Franta and Josh have full access."],
  ["1256269948970846", "Wetility Energy Ad Account (New)", "Ad accounts", "OWNED BY GROWTHCHARTER. Opportunity score 97; uses the website dataset; likely where current campaigns run. Franta and Josh have full access."],
  ["10152035530993227", "Versofy Active (via Wetility)", "Ad accounts", "Owned by Versofy."],
  ["2281510758960134", "WA_Proactive (app)", "Apps", "Owned by Wetility; Franta (two profiles) assigned. Likely the WhatsApp proactive-messaging app: confirm owner and purpose."],
  ["1491473459436478", "health-dashboard (app)", "Apps", "Owned by Wetility; Josh assigned. Confirm purpose."],
  ["17841444826545943", "@wetility.energy (Instagram)", "Instagram", "Owned by Wetility; 5 people assigned."],
  ["+27 83 386 6110", "WhatsApp number (website 'Chat to us')", "WhatsApp", "Owned by Wetility; 1 linked. Messaging account 'Wetility (Pty) Ltd - Chatbot' 855618777528774, business verification in progress."],
  ["+27 65 620 2878", "WhatsApp number (second)", "WhatsApp", "Owned by Wetility. Confirm use; messaging account 'Wetility (Pty) Ltd - Old' 107725401950799."],
  ["676205726979335", "WhatsApp Product Catalog", "Catalogues", "Owned by Wetility; setup not finished; no data connected."],
  ["1257355938127140", "Wetility's Pixel (unused)", "Datasets", "Owned by Wetility, in portfolio 268835702018155; no events ever. The live website dataset 331051689290488 is owned by the other Wetility portfolio 1635612940192332."]
];
async function seedV30() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v30'")).rowCount) return;
  for (const [name, label, parent, desc] of ITEMS) {
    const ex = await q("SELECT id FROM impls WHERE system='meta' AND lower(name)=lower($1)", [name]);
    if (ex.rowCount) await q("UPDATE impls SET label=$2, parent=$3, description=$4 WHERE id=$1", [ex.rows[0].id, label, parent, desc + " (Business settings, 1 Nov 2026)"]);
    else await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('meta','Business settings','integration',$1,$2,$3,TRUE,$4,$5)", [name, label, parent, /unused/.test(label) ? "deprecated" : "live", desc + " (Business settings, 1 Nov 2026)"]);
  }
  const t = "Two Meta ad accounts, including the one in use, are owned by Growth Charter";
  if (!(await q("SELECT 1 FROM issues WHERE title=$1", [t])).rowCount)
    await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ('pb42','Step 3',$1,$2,'high')", [t, "'Wetility Energy Ad Account' (1006220581257195) and 'Wetility Energy Ad Account (New)' (1256269948970846) are owned by GrowthCharter, the former agency; the (New) account uses the website dataset and is probably where campaigns run. Do not remove Growth Charter as a partner until this is solved: Wetility could lose access to the accounts it advertises in. Steps: (1) confirm in Ads Manager which account each live campaign runs in and whose card pays (Billing); (2) ask Growth Charter, and Meta support, whether ownership can move to Wetility (Meta usually does not move ad accounts between businesses); (3) if not, run new campaigns in the Wetility-owned 'Wetility Ad Account' (554889355978936) and move campaigns across after 19 January under the safe-transition plan; (4) only then remove Growth Charter. Also check why Cortado has full access to 554889355978936."]);
  await q("UPDATE issues SET detail = detail || $2 WHERE title=$1 AND position('Do not remove Growth Charter yet' in detail)=0", ["Growth Charter still has access to the Meta dataset", "\n\nUpdate 1 Nov 2026: Do not remove Growth Charter yet. It owns two of the Meta ad accounts, including the one that uses this dataset. See 'Two Meta ad accounts, including the one in use, are owned by Growth Charter'."]);
  await q("UPDATE issues SET detail = detail || $2 WHERE title=$1 AND position('ad accounts owned by GrowthCharter' in detail)=0", ["Meta partners: Cortado has full access to a Wetility ad account; Growth Charter still connected", "\n\nUpdate 1 Nov 2026: keep Growth Charter for now; it owns two ad accounts (ad accounts owned by GrowthCharter: 1006220581257195 and 1256269948970846). Cortado's full access is to the Wetility-owned 'Wetility Ad Account' 554889355978936."]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v30',$1)", [new Date().toISOString()]);
  console.log("Applied Meta portfolio assets v30.");
}
module.exports = { seedV30 };
