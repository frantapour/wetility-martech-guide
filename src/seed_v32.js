// v32: Meta portfolio 268835702018155 integrations and Security Centre review, 1 Nov 2026.
const { q } = require("./db");
const ISSUES = [
  ["pb42", "Step 3", "high", "Meta 'ads MCP server' lets third-party AI agents take all actions on three ad accounts",
    "Business settings > Integrations > ads MCP server shows 7 of 7 actions allowed on Wetility Energy Ad Account (1006220581257195), Wetility Energy Ad Account (New) (1256269948970846) and Versofy Active (10152035530993227). Any AI agent connected by someone with access to these accounts can create, edit and spend, and every connected agent can read the account data. Nobody at Wetility has said they use this. Set actions to none on every account until there is a named use and owner; re-enable per account if needed."],
  ["pb42", "Step 3", "high", "Meta business verification for Wetility (Pty) Ltd was started in March and never submitted",
    "Security Centre: verification started 23 Mar 2026, status 'Pending submission'. An unverified business has lower WhatsApp messaging limits, cannot get some app permissions (the use case chosen was 'App requires access to permissions'), and has a weaker claim in ownership disputes such as the Growth Charter ad accounts. Finish it for the portfolio Wetility keeps long term: company registration documents, a matching business address and phone, and a wetility.energy email or verified domain."],
  ["pb42", "Step 3", "medium", "Meta lead form data is open to every Page admin and any connected CRM",
    "Integrations > Leads access is on the default: all Page admins and connected CRMs for the Wetility Page can download leads (names, phone numbers, emails). Customise access to the named people who need it plus the Freshsales integration, and re-check whenever an agency or employee leaves."],
  ["pb42", "Step 3", "medium", "Meta Security Centre: no peer approval, one user without two-factor, two inactive ad accounts",
    "Three ad accounts have no peer approval (one person can publish ads or change billing alone); turn it on with trusted users. One of five people has no two-factor (Nolan Naicker, see the access review). One inactive Wetility-owned ad account and one inactive account owned by others: identify them before acting. If the Wetility-owned one is 'Wetility Ad Account' 554889355978936, do NOT close it; it is the fallback account for moving campaigns away from Growth Charter. Trusted email domain and domain security for landing pages are not set; both need wetility.energy verified first."],
  ["pb42", "Step 3", "low", "Metricool and Brandwatch are connected to the Facebook Page and Instagram",
    "Conversation routing shows both apps connected to the Page and @wetility.energy, so they can read messages and comments. Confirm who uses each (and who pays for Brandwatch); disconnect any that are no longer used. respond.io WA BSP is the only connected app at portfolio level, which is expected."]
];
async function seedV32() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v32'")).rowCount) return;
  for (const [sec, ref, severity, title, detail] of ISSUES)
    if (!(await q("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount)
      await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
  for (const [name, label, desc] of [["583776698336766", "Metricool (Page and Instagram app)", "Social scheduling/analytics; connected to Page and Instagram. Confirm owner."], ["147626202109722", "Brandwatch (Page and Instagram app)", "Social listening; connected to Page and Instagram. Confirm owner and licence."]])
    if (!(await q("SELECT 1 FROM impls WHERE system='meta' AND name=$1", [name])).rowCount)
      await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('meta','Business settings','integration',$1,$2,'Connected apps',TRUE,'live',$3)", [name, label, desc + " (Business settings, 1 Nov 2026)"]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v32',$1)", [new Date().toISOString()]);
  console.log("Applied Meta integrations and security v32.");
}
module.exports = { seedV32 };
