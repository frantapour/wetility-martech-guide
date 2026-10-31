// v9: findings from the GTM container import (GTM-N9XFQZMK live version, 31 Oct 2026).
const { q } = require("./db");
const ISSUES = [
  ["pb410", "General", "high", "Meta only receives a Lead from Talk to Us; every product-page Meta lead tag is paused",
    "In GTM-N9XFQZMK the active Meta tags are the base pixel (All Pages), 'Meta Talk to Us Lead Submitted', 'Meta Product Page Viewed' and a (TEST) app-download tag. The Meta lead tags for Pace Mini, Medi, Medi Plus, Maxi, Maxi 3PH, Mega, Xtra and Backup are all paused, as is the form-submission conversion. Unless a server-side (CAPI) route exists, Meta campaigns optimising for leads only see Talk to Us leads. TikTok is similar: one 'TikTok - Product Lead' tag is active and the per-product and Talk to Us lead tags are paused. Confirm with the agency which campaigns optimise on which event before changing anything."],
  ["pb45", "General", "medium", "A lead is tracked as 20 different GA4 events and about 14 Google Ads conversion actions",
    "Each product form has its own GA4 event (pace_mini_lead_submitted, lift_medi_lead_submitted, talk_to_us_lead_submitted, savings_calculator_lead_submitted and so on) and its own Google Ads conversion tag. Reporting a total lead count needs every one of them, and Google Ads bidding learns from fragmented conversions. Target: one lead_submitted event (GA4 generate_lead, one Google Ads conversion, Meta Lead) with the product as a parameter."],
  ["pb44", "General", "medium", "Google Ads enhanced-conversion tags fire on different triggers from their conversion tags",
    "For Pace Mini, Maxi, Maxi 3PH and Mega the conversion tag fires on '***Pace … Trigger' while the matching 'EC for Leads' user-data tag fires on 'CE - Pace … - Lead Submitted'. If the two events do not fire together, enhanced conversions will not match. Point both at the same trigger."],
  ["pb45", "General", "medium", "14 tags load on every page, including 9 third-party trackers and two session recorders",
    "All Pages fires GA4, Google Ads, conversion linker, DV360 Floodlight, Meta, TikTok, X, LinkedIn, Snapchat ('SC Tag'), Bing UET, Microsoft Clarity, Hotjar, the Amplitude SDK and an 'Attribution ID Generation' script. Check that they wait for consent (POPIA), that Clarity and Hotjar mask the form fields where people type ID numbers and contact details, and keep only one session recorder."],
  ["pb41", "General", "low", "GTM clean-up: 74 paused tags, test tags live, inconsistent naming",
    "Of 214 tags, 74 are paused. '(TEST) Meta App Download CTA', '(TEST) TikTok App Download CTA' and '*Bing - Conversion Tag (Test)' are live. Names mix *, ** and *** prefixes, some tags and triggers have swapped names (tag 'CE - Let's Talk Clicked' fires on trigger 'GA4 Tag - Let's Talk Clicked'), and 13 DV360 Floodlight tags are active: confirm DV360 is still being bought. Export the container before deleting anything."]
];
async function seedV9() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v9'")).rowCount) return;
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v9',$1)", [new Date().toISOString()]);
  console.log("Applied GTM findings v9.");
}
module.exports = { seedV9 };
