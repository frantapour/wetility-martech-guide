// v39: GTM accounts visible to Franta, 1 Nov 2026.
const { q } = require("./db");
const ITEMS = [
  ["GTM-N9XFQZMK", "wetility.energy (web container)", "GTM account: Wetility. The live Wetility website container (synced via the Google connection)."],
  ["GTM-5KZVMW4N", "versofy.energy (web container)", "GTM account: Versofy New. Versofy is a Wetility brand. Not yet synced or reviewed."],
  ["GTM-5NKC699T", "Versofy FB Server (server container)", "GTM account: Versofy New. Server-side container for Meta Conversions API. Find out where it is hosted (Google Cloud, Stape or other), who pays, and which Meta dataset it sends to. Wetility itself uses the Meta Conversions API Gateway (capig.wetility.energy) instead."]
];
async function seedV39() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v39'")).rowCount) return;
  for (const [name, label, desc] of ITEMS)
    if (!(await q("SELECT 1 FROM impls WHERE system='gtm' AND name=$1", [name])).rowCount)
      await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('gtm','Accounts','container',$1,$2,'GTM accounts',TRUE,'live',$3)", [name, label, desc + " (1 Nov 2026)"]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v39',$1)", [new Date().toISOString()]);
  console.log("Applied GTM accounts v39.");
}
module.exports = { seedV39 };
