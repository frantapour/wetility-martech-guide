// v22: correction after the pixel detail page: TikTok pixel D0ESSGJC77U75NH4NU60 is owned by DarkMatter Marketing (1 Nov 2026).
const { q } = require("./db");
const EVENTS = [
  ["Pageview", "Page view", "Custom code, browser", "EMQ 40; about 21,700 events"],
  ["LandingPageView", "Landing page view", "Custom code, browser", "EMQ 40; about 11,400 events"],
  ["EngagedSession", "Engaged session", "Custom code, browser", "EMQ 40; about 8,200 events"],
  ["Lead", "Submit form", "Events API (server) and custom code; primary source server", "EMQ 47; about 490 events. A server feed already exists: find out who runs it."],
  ["SubmitApplication", "Submit application", "Event Builder (rules set inside TikTok, not in GTM), browser", "EMQ 77; about 200 events"],
  ["CompleteRegistration", "Complete registration", "Event Builder (rules set inside TikTok, not in GTM), browser", "EMQ 87; about 150 events"],
  ["Download", "Download", "Custom code, browser", "EMQ 38; 12 events"],
  ["AI Mode 16th 21st", "AI Mode 16th 21st", "Custom event", "No events: remove"]
];
async function seedV22() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v22'")).rowCount) return;
  await q(`UPDATE impls SET description=$2, parent='Pixels (owned by DarkMatter Marketing)' WHERE system='tiktok' AND name=$1`, ["D0ESSGJC77U75NH4NU60",
    "OWNED BY DARKMATTER MARKETING (Business Center owner on the pixel page), shared with Wetility. Created 9 May 2025, about 42,000 events, status 'Ready for campaign'. This is the pixel in GTM and the one campaigns learn on. (Events Manager, 1 Nov 2026)"]);
  await q(`UPDATE impls SET description=$2 WHERE system='tiktok' AND name=$1`, ["CVH6OG3C77U2AAG9KD8G",
    "Second pixel, created 25 Mar 2025, 0 events, warning flag, name misspelt. Check its Business Center owner: if Wetility owns it, it can become the Wetility-owned pixel run in parallel; if not, archive it. (Events Manager, 1 Nov 2026)"]);
  await q(`UPDATE issues SET detail=$2 WHERE title=$1`, ["Second TikTok pixel is unused",
    "Pixel CVH6OG3C77U2AAG9KD8G ('Wetiltiy TikTok Pixel', created March 2025) has 0 events and a warning flag. Open it and check 'Business Center owner'. If Wetility owns it, it is a candidate for the Wetility-owned pixel to run alongside the agency's pixel (see the ownership problem). If not, archive it once no ad group uses it."]);
  const ISSUES = [
    ["pb43", "Step 2", "high", "TikTok pixel D0ESSGJC77U75NH4NU60 is owned by DarkMatter Marketing",
      "The pixel page shows 'Business Center owner: DarkMatter Marketing'. It is the pixel in GTM, with all the learning (about 42,000 events) and the server Lead feed. If the agency relationship ends, Wetility can lose access to the pixel, its history and audiences. Ask DarkMatter, in writing, whether ownership can be transferred to the Wetility Energy Business Center (confirm with TikTok support what is possible). If it cannot, create a Wetility-owned pixel and run both side by side through the Black Friday period (added in GTM as an extra tag, reported only), then move campaigns to the Wetility pixel after 19 January following the safe-transition plan. Until then, Wetility needs at least Admin-level access on the shared pixel."],
    ["pb43", "Step 4", "medium", "TikTok has three lead-like events, two set up inside TikTok rather than GTM",
      "Lead ('Submit form', about 490, sent mainly from a server through the Events API), SubmitApplication (about 200) and CompleteRegistration (about 150). The last two are made with TikTok's Event Builder, so they are invisible in GTM and in this registry's GTM view. Find out which event the campaigns optimise on, who runs the Events API feed (DarkMatter's server or a Freshsales/respond.io integration) and what each Event Builder rule matches. Target: one Lead event with event_id from browser and server. Also remove the unused custom event 'AI Mode 16th 21st'. Lead EMQ is 47: adding hashed email and phone and ttclid to the server event raises match quality."]
  ];
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  for (const [code, label, src, stat] of EVENTS)
    if (!(await q("SELECT 1 FROM impls WHERE system='tiktok' AND container='Pixel D0ESSGJC77U75NH4NU60' AND lower(name)=lower($1)", [code])).rowCount)
      await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('tiktok','Pixel D0ESSGJC77U75NH4NU60',$1,$2,$3,$4,TRUE,$5,$6)",
        [/^[A-Z][a-zA-Z]+$/.test(code) ? "standard event" : "CRM event", code, label, src, code === "AI Mode 16th 21st" ? "deprecated" : "live", `${src}. ${stat} (Events Manager, 1 Nov 2026).`]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v22',$1)", [new Date().toISOString()]);
  console.log("Applied TikTok ownership correction v22.");
}
module.exports = { seedV22 };
