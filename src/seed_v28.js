// v28: Meta app dataset 3042604735938584 settings (1 Nov 2026): owned by DarkMatter PTY LTD.
const { q } = require("./db");
async function seedV28() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v28'")).rowCount) return;
  await q("UPDATE impls SET description=$2 WHERE system='meta' AND kind='integration' AND name=$1", ["3042604735938584", "Wetility App dataset. OWNED BY DARKMATTER PTY LTD (1477402898998256); created 5 Mar 2026. Shared with the Wetility portfolio 268835702018155 and ad accounts 'DarkMatter' (1502104996528046) and 'Wetility Energy Ad Account (New)'. Linked to Facebook app 904269519251906. Events arrive through Branch; a web Conversions API connection is pending. (Dataset settings, 1 Nov 2026)"]);
  const ITEMS = [["268835702018155", "Wetility business portfolio (second ID)", "Has access to the app dataset. Different from 1635612940192332, which owns the website dataset: confirm whether Wetility has two business portfolios and which one is the main one."], ["1502104996528046", "DarkMatter ad account", "DarkMatter's own ad account has access to the Wetility App dataset. Remove once campaigns run only in Wetility ad accounts."]];
  for (const [name, label, desc] of ITEMS)
    if (!(await q("SELECT 1 FROM impls WHERE system='meta' AND lower(name)=lower($1)", [name])).rowCount)
      await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('meta','Business settings','integration',$1,$2,'Access',TRUE,'live',$3)", [name, label, desc + " (1 Nov 2026)"]);
  const ISSUES = [
    ["pb413", "General", "high", "The Wetility App's Meta dataset and Facebook app are owned by DarkMatter",
      "Dataset 3042604735938584 ('Wetillity', created 5 March 2026) is owned by DarkMatter PTY LTD and linked to Facebook app 904269519251906. DarkMatter's own ad account (1502104996528046) also has access. If the relationship ends, Wetility can lose app campaign measurement and audiences. See gap G24: ask DarkMatter to move the app and dataset into the Wetility portfolio; otherwise build a Wetility-owned app dataset alongside it through Branch and switch after 19 January."],
    ["pb42", "General", "medium", "Wetility appears to have two Meta business portfolios",
      "The website dataset is owned by Wetility 1635612940192332, while the app dataset is shared with Wetility 268835702018155. Confirm whether both exist, who the admins of each are, and consolidate on one (keep the one that owns the website dataset and ad accounts). Two portfolios make access reviews and ownership easy to get wrong."],
    ["pb45", "General", "low", "App dataset sends extra app information to Meta",
      "On the app dataset, automatic event logging, 'more app event details' and 'send more app information for product development' (samples of screen layouts) are On, as are advanced matching and first-party cookies. If the Facebook SDK is in the app, review these with the Information Officer; if events only come through Branch, they have no effect but should still be switched off when ownership moves."]
  ];
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v28',$1)", [new Date().toISOString()]);
  console.log("Applied Meta app dataset ownership v28.");
}
module.exports = { seedV28 };
