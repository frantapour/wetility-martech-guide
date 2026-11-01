// v27: Meta dataset 331051689290488 settings (1 Nov 2026): owned by Wetility; shared with DarkMatter and Growth Charter; CAPI Gateway; pixel settings.
const { q } = require("./db");
const ITEMS = [
  ["1635612940192332", "Wetility business portfolio (owner)", "Business portfolios", "Owns dataset 331051689290488 (dataset Settings, 1 Nov 2026)."],
  ["1477402898998256", "DarkMatter PTY LTD", "Business portfolios", "Has access to dataset 331051689290488 (Sharing). Current agency: reduce to the minimum role; remove after handover."],
  ["3793323217616600", "GrowthCharter", "Business portfolios", "Still has access to dataset 331051689290488 (Sharing). Former agency: remove."],
  ["1006220581257195", "Wetility Energy Ad Account", "Ad accounts", "Has access to dataset 331051689290488. Check owner."],
  ["1256269948970846", "Wetility Energy Ad Account (New)", "Ad accounts", "Has access to dataset 331051689290488. Check owner and which account campaigns run in."],
  ["capig.wetility.energy", "Conversions API Gateway", "Server connections", "Active, events received in the last minute, connected to dataset 331051689290488. This is the server feed behind 'Multiple' events and meta_form_submitted. Confirm whose cloud account hosts and pays for it."]
];
const ISSUES = [
  ["pb42", "Step 3", "high", "Growth Charter still has access to the Meta dataset",
    "Dataset 331051689290488 (owned by Wetility) is shared with DarkMatter PTY LTD (1477402898998256) and GrowthCharter (3793323217616600). Growth Charter is a former agency: remove its access in Business settings (Data sources > Datasets > Assign partners, and Partners). First check it does not host or run the Conversions API Gateway (capig.wetility.energy). DarkMatter keeps the minimum role it needs until handover."],
  ["pb42", "Step 4", "high", "Conversions API Gateway: confirm who hosts and pays for capig.wetility.energy",
    "The Conversions API Gateway is active and sends the server events. A Gateway runs in a cloud account (for example AWS) set up by whoever installed it. If that account belongs to DarkMatter or Growth Charter, the server feed stops when the relationship ends or the bill is not paid. Find the cloud account, the owner and the billing; move it to a Wetility-owned account or plan its replacement (gap G18) before any agency exit."],
  ["pb45", "General", "medium", "Meta pixel settings collect more than the site needs",
    "On dataset 331051689290488: 'Automatically include more detailed page and product info' is On (AI sends page details, reviews and pricing), automatic advanced matching is On (hashed details typed into forms), first-party cookies are on, the dataset category is None, and there is no traffic allow list (anyone can send events with the pixel ID). 'Measure conversions on customer devices' is On from 12 November. For a site that takes ID numbers and credit consent: Information Officer to decide on each switch; recommended: detailed page info Off, advanced matching limited to hashed email and phone sent deliberately, cookies tied to consent, an allow list with wetility.energy and capig.wetility.energy, and a dataset category set. Change during the freeze is allowed for privacy, but tell DarkMatter first because match rates will drop."]
];
async function seedV27() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v27'")).rowCount) return;
  await q("UPDATE impls SET description=$2 WHERE system='meta' AND kind='integration' AND name=$1", ["331051689290488", "Wetility Conversions. OWNED BY WETILITY (business 1635612940192332); created 18 Sep 2023. Shared with DarkMatter PTY LTD and GrowthCharter; used by two ad accounts. Pixel plus Conversions API Gateway (capig.wetility.energy). The dataset in GTM. (Dataset settings, 1 Nov 2026)"]);
  for (const [name, label, parent, desc] of ITEMS)
    if (!(await q("SELECT 1 FROM impls WHERE system='meta' AND lower(name)=lower($1)", [name])).rowCount)
      await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('meta','Business settings','integration',$1,$2,$3,TRUE,'live',$4)", [name, label, parent, desc]);
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  await q("UPDATE issues SET detail = detail || $2 WHERE title=$1 AND position('setting is On' in detail)=0", ["Decide before 12 November: Meta on-device conversion measurement", "\n\nUpdate 1 Nov 2026: the setting is On for dataset 331051689290488 (owned by Wetility), so Wetility can change it."]);
  // Ownership check (G4) done: Meta dataset owned by Wetility; TikTok pixel is not (follow-up in G23).
  await q(`INSERT INTO statuses (key,state,at) VALUES ('gap-G4','done',now()) ON CONFLICT (key) DO UPDATE SET state='done', at=now()`);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v27',$1)", [new Date().toISOString()]);
  console.log("Applied Meta dataset settings v27.");
}
module.exports = { seedV27 };
