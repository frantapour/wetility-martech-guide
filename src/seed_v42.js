// v42: Microsoft Clarity review (project 'Wetility Website', last 30 days to 1 Nov 2026, www.wetility.energy only).
const { q } = require("./db");
const ISSUES = [
  ["pb42", "Website", "high", "8.6% of website sessions hit dead clicks, concentrated in the bundle configurator, alongside React errors",
    "Clarity, last 30 days: 18,964 sessions, dead clicks in 1,628 sessions (8.58%); the AI heatmap summary puts them in the bundle selection area, plus rage clicks on the mobile navigation menu. JavaScript errors in 2.47% of sessions (768 errors): about 35% are React error #418 (the page rendered on the server does not match the browser, which can leave buttons unresponsive until the page recovers), 39% generic 'script error', 11% 'java object is gone' (Android in-app browsers). Performance score 71/100: LCP 3 s, INP 380 ms, CLS 0.13, all 'needs improvement'; 14.6% of page views poor. The configurator (/bundle/recommend and /bundle/.../configure, about 4,500 visits) is where buyers decide. Palota: fix error #418 first, then watch recordings filtered to dead clicks on /bundle pages and make the clicked elements work or look non-clickable."],
  ["pb42", "Website", "medium", "Clarity access: two Gmail accounts, agency admins, and no Wetility marketing admin",
    "Clarity Team: admins are Ayanda Mhlongo and Kholofelo Moyaba (Palota), Ikenna and Lynn (Wetility); members are Amourie Stander (amourie.ilead@gmail.com), FGX Studios (fgxstudios@gmail.com), Tafadzwa Boriwondo (fgx.co.za) and Franta. Recordings show customers' behaviour on forms, so access matters. Make Franta (and Thato from 7 Nov) admin; remove FGX Studios and Tafadzwa if FGX no longer works for Wetility; move Amourie to an iLead company email or remove. Masking is 'Balanced' (typed input and sensitive text masked): keep it, and check 'Mask by element' covers the ID number and phone fields on Let's talk and checkout."],
  ["pb42", "Website", "medium", "TikTok is the second-largest source of website visits, and Clarity's lead counts give a cross-check",
    "Clarity referrers, last 30 days: google.com 5,845 sessions, tiktok.com 4,719, instagram.com 541, m.facebook.com 481, bing.com 459, Google app 423, youtube.com 345 (Facebook in-app browser 753 sessions by browser). TikTok brings almost as many visits as Google, so TikTok's tracking quality (DarkMatter pixel, G23) matters as much as Google's. Smart events: Submit form 1,238 sessions, Subscribe 696, Order success 460 (shown as 'purchases' 2.43%), Contact us 412, Checkout 62. Compare 'Order success' and 'Submit form' with Freshsales web leads for the same 30 days in the baseline (A12). The 'Categories' funnel is broken (0% reach Residential after the homepage): fix the step rules or delete it. The dashboard is filtered to www only, so non-www visits (see the duplicate-host issue) are excluded."]
];
async function seedV42() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v42'")).rowCount) return;
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v42',$1)", [new Date().toISOString()]);
  console.log("Applied Clarity findings v42.");
}
module.exports = { seedV42 };
