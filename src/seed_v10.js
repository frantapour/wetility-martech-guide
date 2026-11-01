// v10: correct the Meta lead issue after checking the 'Meta Submitted Lead' tag in GTM (1 Nov 2026).
const { q } = require("./db");
const OLD = "Meta only receives a Lead from Talk to Us; every product-page Meta lead tag is paused";
const NEW = "Meta receives leads as a custom event (META_Submitted_Lead), not the standard Lead event";
const DETAIL = "Corrected 1 Nov 2026 after checking GTM. The active 'Meta Submitted Lead' tag (Meta Pixel template, pixel 331051689290488) fires on 17 lead triggers: every Pace, Lift, Rise and Luxe product form and Talk to Us. So Meta does see leads from all product forms; the paused per-product Meta tags are old duplicates.\n\nWhat still needs fixing:\n1. The event is a custom event, META_Submitted_Lead, not Meta's standard Lead. Campaigns can only optimise on it through a custom conversion, and Meta's lead models and reporting work best on the standard event.\n2. No event ID is sent, so if a Conversions API feed is added later Meta cannot deduplicate the two.\n3. Talk to Us fires this tag and 'Meta Talk to Us Lead Submitted', so a Talk to Us lead is reported twice under two names.\n4. 'Consent Granted' is hard-coded to True, so the tag fires whatever the visitor chose.\n5. Savings Calculator and Flare leads are not sent to Meta.\n\nTikTok: 'TikTok - Product Lead' is the only active TikTok lead tag; check that it covers the same 17 triggers and that the Talk to Us lead is sent too.\n\nAsk Kopano which event the Meta campaigns optimise on before changing anything.";
async function seedV10() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v10'")).rowCount) return;
  await q("UPDATE issues SET title=$2, detail=$3, severity='medium' WHERE title=$1 AND state='open'", [OLD, NEW, DETAIL]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v10',$1)", [new Date().toISOString()]);
  console.log("Applied Meta lead correction v10.");
}
module.exports = { seedV10 };
