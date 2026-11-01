// v26: the second Meta dataset is the Wetility App dataset fed by Branch (MMP); 904269519251906 is the Facebook app ID, not a dataset (1 Nov 2026).
const { q } = require("./db");
const C = "Dataset 3042604735938584 (Wetility App)";
const EVENTS = [["LOGIN", "24,800"], ["ActivateApp", "17,000"], ["save_device_smart_settings", "957"], ["save_device_soc_settings", "772"], ["purchase_initiated", "156"], ["App installs", "120"], ["fb_mobile_request_deferred_deep_link", "83"], ["meter_search_success", "35"], ["upgrade_submitted", "14"], ["meter_linked", "13"], ["meter_search_failed", "11"], ["meter_link_failed", "8"], ["referral_code_attribution", "4"], ["token_checked_used", "1"]];
async function seedV26() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v26'")).rowCount) return;
  await q("UPDATE impls SET label='Wetility App dataset (name misspelt Wetillity)', description=$2 WHERE system='meta' AND kind='integration' AND name=$1", ["3042604735938584", "The Wetility App's dataset. Events arrive through the mobile measurement partner (Branch). Linked to Facebook app 904269519251906. Keep; only the name needs correcting. Events jumped from about 600 to about 3,000 a day from 19 to 20 October 2026. (Events Manager, 1 Nov 2026)"]);
  await q("UPDATE impls SET label='Facebook app (Wetility App)', description=$2 WHERE system='meta' AND kind='integration' AND name=$1", ["904269519251906", "The Facebook app object for the Wetility App, linked to dataset 3042604735938584. Not a spare dataset. (Events Manager, 1 Nov 2026)"]);
  await q(`UPDATE issues SET state='resolved', resolved_at=now(), resolution=$2 WHERE title=$1 AND state='open'`, ["Two more Meta datasets, both misspelt 'Wetillity'",
    "Checked 1 Nov 2026: 3042604735938584 is the Wetility App dataset (events from Branch) and 904269519251906 is the Facebook app object it belongs to. Both are needed. Only correct the 'Wetillity' spelling."]);
  for (const [name, n] of EVENTS)
    if (!(await q("SELECT 1 FROM impls WHERE system='meta' AND container=$1 AND lower(name)=lower($2)", [C, name])).rowCount)
      await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('meta',$1,$2,$3,'','App events via Branch',TRUE,'live',$4)", [C, /^(ActivateApp|App installs|fb_mobile)/.test(name) ? "standard event" : "custom event", name, `${n} events, 4 to 31 Oct 2026, through Branch (mobile measurement partner).`]);
  const t = "Wetility App sends Meta no completed purchase and no values";
  if (!(await q("SELECT 1 FROM issues WHERE title=$1", [t])).rowCount)
    await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ('pb413','General',$1,$2,'medium')", [t, "Through Branch, Meta receives purchase_initiated (156 in 4 weeks) but no completed purchase, and no value on any event, while GA4 also records purchase and purchase_failed. For prepaid top-ups and One Bill, send the completed purchase with value and currency (Meta's standard Purchase) through Branch, so app campaigns can optimise on buyers. Also check what changed on 19 to 20 October, when app events jumped about five-fold (mostly LOGIN and ActivateApp): a new app release or Branch setting, not necessarily more users. LOGIN at 24,800 a month should not be used to optimise any campaign."]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v26',$1)", [new Date().toISOString()]);
  console.log("Applied Meta app dataset v26.");
}
module.exports = { seedV26 };
