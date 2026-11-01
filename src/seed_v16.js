// v16: findings from reading wetility.energy (page text and head tags), 1 Nov 2026.
const { q } = require("./db");
const ISSUES = [
  ["pb411", "General", "high", "Let's talk form bundles credit-check consent into one 'terms and conditions' tick",
    "The pre-qualification form has a single checkbox 'I agree to the terms and conditions' that also covers 'I consent to a credit check', suretyship and authority to sign. There is no separate marketing-consent choice and the privacy policy is only linked in the footer. Under POPIA, consent to a credit check and to direct marketing should be specific and separate. Information Officer to review; this is also the consent the ad-platform signals depend on."],
  ["pb411", "General", "medium", "Home and key pages have no H1, others have several",
    "The home page, FAQs, Let's talk and Newsroom have no H1; ai mode has four H1s and One Bill three. The home page title leads with 'Beast Bundle Solutions'. Give every page one H1 that states what the page is about (for example 'Solar subscriptions for your home, no upfront cost'), and use H2/H3 for sections."],
  ["pb411", "General", "medium", "Newsroom and articles are hard for search engines to use",
    "Only one article is in the newsroom page's HTML; the rest load with 'Load more'. Articles have no canonical tag, some have ID-style URLs (/newsroom/d56c1758-…), headings are not marked up, and the most recent posts date from 2023 and 2025. Render the article list in HTML with pagination, add canonicals and readable slugs, and publish regularly on the questions people search (cost, rent vs buy, savings, load shedding)."],
  ["pb411", "General", "low", "Share and accessibility tags missing",
    "Most pages have no og:image or og:url, so shared links show without an image. The viewport tag sets maximum-scale=1, which stops people zooming on phones (an accessibility failure). The recommendation page has no canonical and about 140 words of text."],
  ["pb411", "General", "medium", "Savings claims differ across pages",
    "ai mode says 'up to 90% solar savings', One Bill says 'up to 25% guaranteed savings', and meta descriptions mention Beast Bundles alongside the PACE, RISE, LIFT and LUXE series. Align claims and product names with the approved savings wording and the 1 November range before ads point at these pages; ad copy and landing pages must say the same thing."],
  ["pb48", "General", "medium", "WhatsApp chat links carry no source",
    "'Chat to us' links go to wa.me/+27833866110 without a prefilled message or reference, so WhatsApp leads from the website cannot be tied to the page, campaign or click ID. Add a prefilled message with a short reference per page or campaign that respond.io records, so WhatsApp leads join the same funnel."]
];
async function seedV16() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v16'")).rowCount) return;
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v16',$1)", [new Date().toISOString()]);
  console.log("Applied website findings v16.");
}
module.exports = { seedV16 };
