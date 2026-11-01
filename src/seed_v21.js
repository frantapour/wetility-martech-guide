// v21: TikTok Events Manager data sources, from Franta's screenshots (1 Nov 2026).
const { q } = require("./db");
const ITEMS = [
  ["D0ESSGJC77U75NH4NU60", "Wetility Pixel 2025", "Pixels", "Owned by the Wetility Energy Business Center and shared with another account ('Shared by you'). Created 9 May 2025; about 42,000 events. This is the pixel in GTM."],
  ["CVH6OG3C77U2AAG9KD8G", "Wetiltiy TikTok Pixel", "Pixels", "Owned by Wetility, shared out. Created 25 Mar 2025, 0 events, warning flag, name misspelt. Unused: archive once no ad group references it."],
  ["energy.wetility.consumer", "Wetility (Android app)", "Apps", "App data source, SAN enabled, events come from the MMP (Branch): about 16,900; SDK events 0."],
  ["1643096105", "Wetility (iOS app)", "Apps", "App data source, SAN enabled, MMP (Branch) events about 4,700; SDK events 0."],
  ["7631156656748576776", "Wetility CRM", "CRM event sets", "CRM data source created 21 Apr 2026. 0 events: nothing has been sent."],
  ["7678378899214024725", "Freshsale WIP", "CRM event sets", "CRM data source created 26 Aug 2026. 0 events: nothing has been sent. Duplicate of 'Wetility CRM'."]
];
const ISSUES = [
  ["pb410", "Step 3", "medium", "TikTok has two CRM event sets and neither has received an event",
    "Events Manager shows 'Wetility CRM' (created April 2026) and 'Freshsale WIP' (created August 2026), both with 0 events. TikTok cannot optimise on lead quality or later stages until one of them receives CRM events (lead, contacted, contract, install with ttclid). Keep one, delete the other, and feed it from the server events in the build plan (gaps G16 and G17). Lead-quality optimisation needs more than about 50 events in 14 days."],
  ["pb43", "General", "low", "Second TikTok pixel is unused",
    "Pixel CVH6OG3C77U2AAG9KD8G ('Wetiltiy TikTok Pixel', created March 2025) has 0 events and a warning flag. Check no ad group or audience uses it, then archive it so only D0ESSGJC77U75NH4NU60 remains. Both are shared out from Wetility's Business Center: check in each pixel's sharing settings which partner has access (likely the agency) and that the role is the minimum needed."]
];
async function seedV21() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v21'")).rowCount) return;
  for (const [name, label, container, desc] of ITEMS)
    if (!(await q("SELECT 1 FROM impls WHERE system='tiktok' AND lower(name)=lower($1)", [name])).rowCount)
      await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('tiktok',$1,'integration',$2,$3,$4,TRUE,$5,$6)", ["Events Manager", name, label, container, name === "CVH6OG3C77U2AAG9KD8G" ? "deprecated" : "live", desc + " (Events Manager, 1 Nov 2026)"]);
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  // Ownership check (gap G4) is half done: TikTok confirmed, Meta still to check.
  await q(`INSERT INTO statuses (key,state,at) VALUES ('gap-G4','progress',now()) ON CONFLICT (key) DO NOTHING`);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v21',$1)", [new Date().toISOString()]);
  console.log("Applied TikTok Events Manager v21.");
}
module.exports = { seedV21 };
