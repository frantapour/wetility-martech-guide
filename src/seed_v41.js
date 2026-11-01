// v41: Semrush Organic Rankings detail, 1 Nov 2026.
const { q } = require("./db");
const ISSUES = [
  ["pb42", "SEO", "medium", "wetility.energy and www.wetility.energy are both indexed as separate sites",
    "Semrush ranks pages on both hosts: www.wetility.energy (84% of organic traffic, 42 keywords) and wetility.energy (16%, 52 keywords), including /outages on both, plus http versions with their own backlinks. Search engines split ranking strength and backlinks between duplicates. Fix (Palota): one host (www) with a permanent 301 redirect from wetility.energy and from http, and self-referencing canonicals. Safe to do during the freeze if tested: it does not touch tracking, but check the GTM container and the Conversions API Gateway still fire on the final host."],
  ["pb42", "SEO", "medium", "Google Business Profile and local listings: 'Poor', 46 of 49 listings to fix",
    "Semrush local check for 'Wetility, 128 Peter Road, Sandton': online presence Poor, 46 of 49 directory listings missing or wrong. 11 tracked keywords show a Google local pack and Wetility appears in none; 76 show review results. Confirm the address is current, claim and complete the Google Business Profile (hours, service area, categories, photos), and ask installed customers for Google reviews. Hellopeter (25 backlinks) is already a review source."],
  ["pb42", "SEO", "low", "Non-brand search for solar subscription is unclaimed",
    "Non-branded organic traffic is about 650 visits a month, mostly from /outages. Semrush's 'competitors' are outage sites (citypower.co.za) and unrelated domains, not solar subscription providers: nobody is winning these searches through SEO, so a small set of pages (solar subscription, rent-to-own solar, solar with no upfront cost, by city) could rank. Thato to brief iLead or Palota after the freeze, once savings claims are aligned."]
];
async function seedV41() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v41'")).rowCount) return;
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v41',$1)", [new Date().toISOString()]);
  console.log("Applied Semrush organic rankings v41.");
}
module.exports = { seedV41 };
