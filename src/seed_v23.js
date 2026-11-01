// v23: TikTok pixel settings page (1 Nov 2026): Business Center IDs, GA4 partner connection, privacy settings to check.
const { q } = require("./db");
const ITEMS = [
  ["7366635301369954321", "DarkMatter Marketing Business Center", "Business Centers", "Owner of pixel D0ESSGJC77U75NH4NU60 (Accounts and permissions, 1 Nov 2026)."],
  ["7696451525908004916", "Wetility Energy Business Center", "Business Centers", "Wetility's own TikTok Business Center (org_id seen when viewing the pixel). Target owner of every Wetility pixel and ad account."],
  ["7455352392268169232", "TikTok ad account (advertiser ID)", "Ad accounts", "Advertiser account used to view the pixel (aadvid). Check which Business Center owns it."],
  ["ga4-304079032", "Google Analytics partner connection (properties/304079032)", "Data connections", "GA4 property 304079032 is connected to the pixel as a partner integration. Check which GA4 events it passes to TikTok: GA4 has about 30 key events, including logins and clicks."]
];
const ISSUES = [
  ["pb45", "General", "high", "TikTok pixel privacy settings: check Automatic Advanced Matching and enhanced data postback",
    "The pixel offers Automatic Advanced Matching (collects email, name and phone typed into website forms), first-party cookies and 'enhanced data postback' (collects page content, clicks and time on page). TikTok itself recommends manual matching instead of automatic for financial-services sites. Wetility's forms take ID numbers and credit consent, so: turn Automatic Advanced Matching off and send only hashed email and phone deliberately (manual matching or the Events API), turn enhanced data postback off unless the Information Officer approves it, and make cookies follow the consent choice. These settings sit on a pixel DarkMatter owns, so changes must be agreed with them and logged."],
  ["pb43", "General", "medium", "GA4 is connected to the TikTok pixel as a partner",
    "Data connection shows Google Analytics properties/304079032 connected. Find out what it sends: if TikTok takes GA4 conversions, it may count the same lead twice (pixel plus GA4) or count logins and clicks that GA4 marks as key events. Keep one source per event."]
];
async function seedV23() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v23'")).rowCount) return;
  for (const [name, label, parent, desc] of ITEMS)
    if (!(await q("SELECT 1 FROM impls WHERE system='tiktok' AND lower(name)=lower($1)", [name])).rowCount)
      await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('tiktok','Events Manager','integration',$1,$2,$3,TRUE,'live',$4)", [name, label, parent, desc]);
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v23',$1)", [new Date().toISOString()]);
  console.log("Applied TikTok pixel settings v23.");
}
module.exports = { seedV23 };
