// v19: respond.io message fields from the messages export header (field names only), 1 Nov 2026.
const { q } = require("./db");
const Importer = require("../public/importer.js");
const F = ["Date & Time", "Sender ID", "Sender Type", "Contact ID", "Message ID", "Content Type", "Message Type", "Content", "Channel ID", "Type", "Sub Type"];
async function seedV19() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v19'")).rowCount) return;
  for (const label of F) {
    const name = Importer.slug(label);
    if ((await q("SELECT 1 FROM impls WHERE system='respond' AND container='Message fields' AND lower(name)=lower($1)", [name])).rowCount) continue;
    await q("INSERT INTO impls (system,container,kind,name,label,parent,std,state,description) VALUES ('respond','Message fields','field',$1,$2,'Messages',TRUE,'live',$3)",
      [name, label, label === "Content" ? "The message text itself: raw WhatsApp transcripts are personal data and must never go to GTM, GA4, Amplitude or ad platforms." : label === "Sub Type" || label === "Type" ? "Check whether inbound messages from click-to-WhatsApp ads carry an ad referral type here; if so it is the source for ctwa_clid and ad ID." : "Standard message field (respond.io messages export, 1 Nov 2026)."]);
  }
  const t = "respond.io message exports contain full WhatsApp transcripts";
  if (!(await q("SELECT 1 FROM issues WHERE title=$1", [t])).rowCount)
    await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ('pb48','General',$1,$2,'medium')", [t, "The messages export includes Content (the message text), so anyone who can export messages can take every customer conversation, including ID numbers, addresses and banking details typed into chat. Limit who can export, never upload exports to other tools, and keep transcripts out of analytics and ad platforms (risk gate in 'Read this first'). Use Type and Sub Type to check whether click-to-WhatsApp ad referrals are recorded, without exporting Content."]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v19',$1)", [new Date().toISOString()]);
  console.log("Applied respond.io message fields v19.");
}
module.exports = { seedV19 };
