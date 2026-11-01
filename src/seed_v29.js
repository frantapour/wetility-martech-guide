// v29: Meta business portfolio 268835702018155 (Business info, People, Partners), 1 Nov 2026.
const { q } = require("./db");
const ISSUES = [
  ["pb42", "Step 3", "high", "Meta partners: Cortado has full access to a Wetility ad account; Growth Charter still connected",
    "Business portfolio 268835702018155 > Partners lists Cortado Business Manager (679772052966029), DarkMatter PTY LTD, respond.io, Freshworks Inc, GrowthCharter and Versofy. Cortado can access 7 assets, including the Wetility Page (partial: content, messages, ads, insights, leads) and 'Wetility Ad Account' with FULL access. If Cortado and Growth Charter no longer work for Wetility, remove their assets and the partner link (check first that the Conversions API Gateway and any running campaigns do not depend on them). Keep respond.io and Freshworks only for the assets their integrations need; confirm what Versofy needs."],
  ["pb42", "Step 2", "high", "Meta portfolio people: full access without two-factor, a Gmail invitation, an agency person invited directly",
    "People in portfolio 268835702018155: Nolan Naicker has full access including finance management, two-factor not on, and no activity; 'wetility.energy@gmail.com' is invited with full access; Kopano Boikanyo (DarkMatter) has a personal partial-access login next to DarkMatter's partner access. Remove Nolan's access if he has left (otherwise require two-factor and reduce to what he needs), cancel the Gmail invitation unless someone can account for it, and move agency people to their company's partner access. Target: two or three named Wetility admins with two-factor, everyone else least access."],
  ["pb42", "General", "medium", "Wetility's main Meta business portfolio is unverified",
    "Portfolio 268835702018155 (Wetility (Pty) Ltd, created 12 Jan 2022, primary Page Wetility) shows 'Unverified'. Some Meta products and higher WhatsApp limits need a verified business. Verify it with the company registration documents once you have decided which portfolio stays (see the two-portfolio problem)."]
];
async function seedV29() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v29'")).rowCount) return;
  await q("UPDATE issues SET severity='high', detail=$2 WHERE title=$1", ["Wetility appears to have two Meta business portfolios",
    "Confirmed 1 Nov 2026. Portfolio 268835702018155 is 'Wetility (Pty) Ltd', created 12 Jan 2022, with the legal details, the Wetility Page, 6 people and 6 partners; it is unverified. The website dataset 331051689290488 (the leads) is owned by a different 'Wetility' portfolio, 1635612940192332. Check who administers 1635612940192332 and what else it owns (ad accounts, pixels, Pages). Decide which portfolio stays (probably 268835702018155, the legal entity) and move assets so that one Wetility portfolio owns the Page, datasets, ad accounts and WhatsApp accounts."]);
  await q("UPDATE impls SET label='Wetility (Pty) Ltd business portfolio (main)', description=$2 WHERE system='meta' AND name=$1", ["268835702018155", "Wetility (Pty) Ltd, created 12 Jan 2022, primary Page Wetility, unverified. 6 people (4 with full access), partners: Cortado, DarkMatter, respond.io, Freshworks, GrowthCharter, Versofy. (Business settings, 1 Nov 2026)"]);
  for (const [name, label, desc] of [["679772052966029", "Cortado Business Manager (partner)", "Partner with access to 7 Wetility assets, including 'Wetility Ad Account' with full access and the Wetility Page. Confirm whether Cortado still works for Wetility."]])
    if (!(await q("SELECT 1 FROM impls WHERE system='meta' AND lower(name)=lower($1)", [name])).rowCount)
      await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('meta','Business settings','integration',$1,$2,'Partners',TRUE,'live',$3)", [name, label, desc + " (1 Nov 2026)"]);
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  await q(`INSERT INTO statuses (key,state,at) VALUES ('acc-meta','progress',now()) ON CONFLICT (key) DO UPDATE SET state='progress', at=now()`);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v29',$1)", [new Date().toISOString()]);
  console.log("Applied Meta portfolio review v29.");
}
module.exports = { seedV29 };
