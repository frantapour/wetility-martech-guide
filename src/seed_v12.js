// v12: findings from the Amplitude sync of project 89b022e4 (1 Nov 2026).
const { q } = require("./db");
const ISSUES = [
  ["pb49", "General", "medium", "GTM's internal events and a second page view are sent to Amplitude",
    "Amplitude project 89b022e4 receives gtm.js, gtm.dom, gtm.load, gtm.init and gtm.init_consent as events. These are GTM's own housekeeping events, not user actions; they inflate event volume (and Amplitude cost) and clutter every chart. Page views are also counted twice: the custom page_viewed and Amplitude's automatic [Amplitude] Page Viewed. Find the GTM tag that forwards every dataLayer event and filter out gtm.*; keep one page view event."],
  ["pb45", "General", "medium", "Amplitude receives 'respondio_id_number_given' and records session replays",
    "Check what properties the respondio_id_number_given event carries: the event name is fine, the ID number itself must never be a property. [Amplitude] Replay Captured shows Amplitude Session Replay is on, which makes three session recorders (Clarity, Hotjar, Amplitude). Keep one, and make sure it masks the form fields where people type ID numbers and contact details."],
  ["pb49", "General", "low", "Wetility has more than one Amplitude project",
    "Project 89b022e4 holds the real tracking (59 events, including website, respond.io, credit, site inspection, installation and CoC events). Another project holds only automatic page views, clicks and Daily Ad Metrics. GTM's 'Amplitude SDK Initialisation' tag uses API key 3ffe3f08…. Confirm which project each key belongs to, which one dashboards use, and retire the other."],
  ["pb45", "General", "low", "Amplitude event names follow three different styles",
    "Website events use snake_case (address_entered, talk_to_us_form_submitted); back-office events use other styles ('Site Inspection-Scheduled', 'New-Install. Job Completed', 'COC Inspection Completed', 'Credit Check Approved', 'Contact Created'). Map each to the canonical event in this registry and rename at the source when it is next touched, so funnels and cohorts do not break silently."]
];
async function seedV12() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v12'")).rowCount) return;
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v12',$1)", [new Date().toISOString()]);
  console.log("Applied Amplitude findings v12.");
}
module.exports = { seedV12 };
