// v25: Meta Events Manager, dataset 331051689290488 'Wetility Conversions' (screenshot and text, 1 Nov 2026; last 4 weeks).
const { q } = require("./db");
const C = "Dataset 331051689290488";
const EVENTS = [
  ["PageView", "standard event", "Browser and server (Multiple). EMQ 6.2/10, update recommended. About 136,100 events in 4 weeks."],
  ["META_Product_Viewed", "custom event", "Browser and server. EMQ 6.1/10. About 34,600 events."],
  ["Lead", "standard event", "Browser and server. EMQ 9.2/10. About 2,500 events in 4 weeks (about 625 a week)."],
  ["meta_form_submitted", "custom event", "Conversions API only (server). EMQ 5.6/10, update recommended. About 1,500 events."],
  ["META_Submitted_Lead", "custom event", "Browser and server (GTM tag 'Meta Submitted Lead'). EMQ 9.3/10. About 1,000 events."],
  ["Contact", "standard event", "Browser and server. EMQ 7.5/10. About 290 events."],
  ["app_download_CTA", "custom event", "Browser and server. EMQ 6.3/10. 58 events."]
];
const DATASETS = [
  ["331051689290488", "Wetility Conversions", "Pixel and Conversions API. Websites: www.wetility.energy and one more. The dataset in GTM."],
  ["3042604735938584", "Wetillity (misspelt)", "Second dataset (app icon). Check what it is used for and who owns it."],
  ["904269519251906", "Wetillity (misspelt, greyed out)", "Third dataset, greyed out with an info flag: inactive or no access. Check owner; remove from the portfolio if unused."]
];
const ISSUES = [
  ["pb410", "Step 1", "high", "Meta receives three different lead events",
    "In the last 4 weeks the Wetility Conversions dataset received Lead (about 2,500, browser and server, match quality 9.2), META_Submitted_Lead (about 1,000, browser and server, 9.3) and meta_form_submitted (about 1,500, Conversions API only, 5.6). A Conversions API feed already exists, so part of the server side is built, but nobody on Wetility's side documents it. One lead may be counted two or three times, and campaigns may optimise on any of the three. Ask DarkMatter which event each campaign optimises on, who sends meta_form_submitted and from which system, and whether browser and server events share an event_id. Target: one standard Lead event, browser plus server, deduplicated."],
  ["pb410", "Step 2", "medium", "Meta Conversions API for CRM is not set up",
    "Events Manager prompts 'Finish setting up Conversions API for CRM'. Until CRM stages (contacted, contract signed, installed) are sent, Meta optimises on form fills, not on customers. Volume is there: about 625 leads a week, above Meta's guide of about 50 conversions per ad set per week. This is gap G18 (postbacks) in the target architecture; send the stages as reported-only first."],
  ["pb45", "General", "medium", "Decide before 12 November: Meta on-device conversion measurement",
    "Meta says that from 12 November 2026 all eligible pixels start measuring conversions on customer devices automatically, with an opt-out in Events Manager settings. Meta states no identifying customer information is shared. Information Officer to decide before 12 November whether to stay in or opt out, and record the decision; the dataset owner (check who owns it) makes the change."],
  ["pb42", "Step 3", "low", "Two more Meta datasets, both misspelt 'Wetillity'",
    "Datasets 3042604735938584 and 904269519251906 (greyed out) sit next to Wetility Conversions. Check each one's owner and use in Settings; delete or remove unused ones from the portfolio so ads cannot be pointed at the wrong dataset."]
];
async function seedV25() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v25'")).rowCount) return;
  for (const [name, kind, desc] of EVENTS)
    if (!(await q("SELECT 1 FROM impls WHERE system='meta' AND container=$1 AND lower(name)=lower($2)", [C, name])).rowCount)
      await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('meta',$1,$2,$3,'','Events received',TRUE,'live',$4)", [C, kind, name, desc + " (Events Manager, 4 Oct to 31 Oct 2026)"]);
  for (const [name, label, desc] of DATASETS)
    if (!(await q("SELECT 1 FROM impls WHERE system='meta' AND lower(name)=lower($1) AND kind='integration'", [name])).rowCount)
      await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('meta','Datasets','integration',$1,$2,'Datasets',TRUE,'live',$3)", [name, label, desc + " (Events Manager, 1 Nov 2026)"]);
  await q("UPDATE issues SET detail = detail || $2 WHERE title=$1 AND position('three different lead events' in detail)=0", ["Meta receives leads as a custom event (META_Submitted_Lead), not the standard Lead event",
    "\n\nUpdate 1 Nov 2026 from Events Manager: Meta also receives the standard Lead event (about 2,500 in 4 weeks) and meta_form_submitted through the Conversions API. See the problem 'Meta receives three different lead events'."]);
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v25',$1)", [new Date().toISOString()]);
  console.log("Applied Meta Events Manager v25.");
}
module.exports = { seedV25 };
