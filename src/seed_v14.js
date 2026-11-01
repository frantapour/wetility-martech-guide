// v14: findings from the first Google sync (GTM live version 122, GA4 property 304079032), 1 Nov 2026.
const { q } = require("./db");
const ISSUES = [
  ["pb49", "General", "medium", "GA4 has about 30 key events, and a lead is 20 of them",
    "GA4 property 304079032 marks about 30 events as key events: 20 per-product lead events (pace_mini_lead_submitted, lift_medi_lead_submitted and so on), plus login, chat_to_us_clicked, meter_search_success, meter_linked, purchase_initiated, flare_form_submitted, first_open and the default app purchase events. savings_calculator_lead_submitted fires but is not a key event. With this many key events, 'conversions' in GA4 and anything imported into Google Ads mixes leads with logins and clicks. Target: key events = lead submitted (one event, product as a parameter), contract signed, install completed, app purchase; everything else stays a normal event."],
  ["pb49", "General", "medium", "Values are built into GA4 event names",
    "GA4 receives events like package_quantity_increased_LUXE MEDI, premise_selected_LIFT Series_Farm, power_level_adjusted_1 to _7, phase_selected 1 and 3, and tab_selected_Home / _Business. Each product, premise or level becomes a separate event name, several are cut off at GA4's 40-character limit, some contain spaces, and they count towards GA4's limit of 500 distinct event names per app. Send one event (package_quantity_changed, premise_selected, power_level_adjusted, phase_selected, tab_selected) with the value as a parameter."]
];
async function seedV14() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v14'")).rowCount) return;
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v14',$1)", [new Date().toISOString()]);
  console.log("Applied GA4 findings v14.");
}
module.exports = { seedV14 };
