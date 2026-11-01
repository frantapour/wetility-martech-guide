// v40: Semrush review of wetility.energy (Domain Overview ZA desktop 31 Oct 2026, Site Audit, Position Tracking), 1 Nov 2026.
const { q } = require("./db");
const ISSUES = [
  ["pb42", "SEO", "high", "Semrush links wetility.energy to fashion topics and paid-link spam: check the site has not been hacked",
    "Semrush Key Topics for wetility.energy show 'EU to UK shoe size' (200K), 'Women's Dresses' (125K) and 'Women's Bottoms' (75K), unrelated to solar. The top backlink anchors include 'high quality dofollow backlinks ... pbn network ... buy backlinks' (78 domains) and 'professional niche edit links for wetility.energy' (43 domains). This pattern can mean injected spam pages on the site (a hack) or a negative-SEO link attack; it could also be a Semrush topic error. Checks: (1) Google 'site:wetility.energy dresses' and 'site:wetility.energy shoe'; (2) Search Console > Security and manual actions, and Pages for unknown URLs; (3) ask Palota whether any pages exist outside the sitemap; (4) ask iLead whether they bought links. Disavow only if Search Console shows a manual action."],
  ["pb42", "SEO", "medium", "Organic search is almost all branded: SEO is not bringing in new demand",
    "Semrush ZA: about 4.4K organic visits a month, of which about 3.8K come from navigational searches ('wetility', 'wetility solar'). Commercial keywords: 7, with no traffic; transactional: 3, about 22 visits. Branded traffic stepped up in August 2026, which is what paid social and offline activity create. Implications: (1) do not credit Google organic or brand search with leads that paid social created; report branded and non-branded separately; (2) the only real non-brand asset is /outages (position 5 for 'power outage', 27.1K searches), which is informational: add a clear route to a quote or WhatsApp, and update its title from 2025; (3) non-brand pages for 'solar subscription', 'rent solar panels' and 'solar without upfront cost' are missing or not ranking. AI visibility 14 (ChatGPT 4, Gemini 4, AI Mode 3, AI Overviews 0); top cited sources energybee.co.za, versofy.energy, solarguide.co.za."],
  ["pb42", "SEO", "low", "Semrush site audit is 19 weeks old and limited to 100 pages",
    "Last audit about June 2026: site health 71%, 78 errors, 217 warnings, crawlability 89%, 76 of 100 pages crawled (free plan, one project). Semrush also shows no paid search traffic, which fits Google Ads running mostly outside classic search or Semrush missing it: confirm once Wetility has Google Ads access. Rerun the audit after the website fixes (A19) and compare with this app's crawl."]
];
async function seedV40() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v40'")).rowCount) return;
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v40',$1)", [new Date().toISOString()]);
  console.log("Applied Semrush findings v40.");
}
module.exports = { seedV40 };
